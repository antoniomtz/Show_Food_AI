const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https'); // Import https module
require('dotenv').config();

// Create an HTTPS agent with keepAlive set to false
const httpsAgentNoKeepAlive = new https.Agent({ keepAlive: false });

let prewarmDoneSuccessfully = false; // Flag to track pre-warm status

const app = express();
const PORT = process.env.PORT || 3001;

// Simple in-memory store for tracking image generation
const imageGenerationStore = {
  menuItems: {},  // Will store menu items with their images when generated
  getRequestId: () => Math.random().toString(36).substring(2, 15) // Simple ID generator
};

// Enable CORS for frontend requests
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Proxy endpoint for Nvidia API to analyze menu
app.post('/api/analyze-menu', async (req, res) => {
  try {
    console.log('Received request to analyze menu');
    
    // If pre-warming was just done, add a small delay before the first real request
    if (prewarmDoneSuccessfully) {
      console.log('Pre-warming was recently successful. Adding a 3-second delay before processing user request.');
      await new Promise(resolve => setTimeout(resolve, 3000));
      prewarmDoneSuccessfully = false; // Reset flag so this delay only happens once
    }
    
    const { image, prompt } = req.body;
    
    // Validate inputs
    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }
    
    const API_URL = process.env.VITE_NVIDIA_API_URL;
    const API_TOKEN = process.env.VITE_NVIDIA_API_TOKEN;
    const MODEL = process.env.VITE_NVIDIA_MODEL;
    
    console.log('Using API URL:', API_URL);
    console.log('Using Model:', MODEL);
    
    try {
      // Forward the request to Nvidia API with increased timeout
      let apiResponse;
      let retryCount = 0;
      const maxRetries = 2; // Increase to 2 retries (3 total attempts)
      
      while (retryCount <= maxRetries) {
        try {
          console.log(`API request attempt ${retryCount + 1}/${maxRetries + 1}`);
          apiResponse = await axios.post(
            API_URL,
            {
              model: MODEL,
              messages: [
                {
                  role: 'user',
                  content: `${prompt} <img src="data:image/png;base64,${image}" />`
                }
              ],
              max_tokens: 1024,
              temperature: 0.5,
              top_p: 0.95,
              stream: false
            },
            {
              headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              },
              // Increase timeout for first attempt
              timeout: retryCount === 0 ? 180000 : 120000, // 3 min for first try, 2 min for retries
              httpsAgent: httpsAgentNoKeepAlive // Use custom agent
            }
          );
          
          // If we get here, the request was successful
          break;
        } catch (retryError) {
          retryCount++;
          console.log(`API request attempt ${retryCount} failed: ${retryError.message}`);
          
          if (retryCount > maxRetries) {
            // Rethrow the error if we've exhausted all retries
            throw retryError;
          }
          
          // Wait longer before retrying (exponential backoff)
          const waitTime = 2000 * Math.pow(2, retryCount - 1); // 2s, 4s, 8s
          console.log(`Waiting ${waitTime/1000} seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      console.log('Received response from Nvidia API');
      
      // Extract menu items from the response
      const menuItems = extractMenuItems(apiResponse.data);
      console.log(`Extracted ${menuItems.length} menu items`);
      
      // Generate a request ID
      const requestId = imageGenerationStore.getRequestId();
      
      // Create initial items with loading state
      const initialItems = menuItems.map(item => ({
        ...item,
        imageUrl: null,
        imageStatus: 'loading'
      }));
      
      // Store the initial menu items for this request
      imageGenerationStore.menuItems[requestId] = [...initialItems];
      
      // Send first response with text content and loading images
      res.json({
        requestId,
        menuItems: initialItems
      });
      
      // Then process images in the background
      if (menuItems.length > 0) {
        processImagesInBackground(menuItems, requestId);
      }
    } catch (err) {
      console.error('Error in Nvidia API request:', err);
      return res.status(500).json({ 
        error: 'Failed to process the menu image',
        message: err.message
      });
    }
  } catch (error) {
    console.error('Error in proxy server:', error);
    
    // Send detailed error information
    res.status(500).json({
      error: error.message,
      details: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    });
  }
});

// Endpoint to poll for image generation status
app.get('/api/menu-images/:requestId', (req, res) => {
  const { requestId } = req.params;
  
  if (!imageGenerationStore.menuItems[requestId]) {
    return res.status(404).json({ error: 'Request not found' });
  }
  
  // Return the current state of the menu items for this request
  res.json({
    menuItems: imageGenerationStore.menuItems[requestId]
  });
});

// Process images in background after text content is sent
async function processImagesInBackground(menuItems, requestId) {
  // Check if we should attempt image generation
  if (!process.env.VITE_NVIDIA_API_TOKEN) {
    console.log('No API token available for image generation.');
    updateMenuItemsStatus(requestId, 'skipped');
    return;
  }
  
  if (menuItems.length > 5) {
    console.log('Too many menu items. Skipping image generation.');
    updateMenuItemsStatus(requestId, 'skipped');
    return;
  }
  
  // Add images to menu items (one at a time to avoid rate limiting)
  let imageGenerationErrorCount = 0;
  
  for (let i = 0; i < menuItems.length; i++) {
    const item = menuItems[i];
    console.log(`Processing menu item: ${item.title}`);
    
    // Skip further image generation if we've had multiple failures
    if (imageGenerationErrorCount < 2) {
      try {
        const imageUrl = await generateFoodImage(item.description);
        
        if (imageUrl) {
          console.log(`Image generation successful for: ${item.title}`);
          // Update the item in our store
          updateMenuItemImage(requestId, i, imageUrl, 'success');
        } else {
          console.log(`Image generation failed for: ${item.title}`);
          updateMenuItemImage(requestId, i, null, 'failed');
          imageGenerationErrorCount++;
        }
      } catch (imgErr) {
        console.error(`Error generating image for ${item.title}:`, imgErr.message);
        updateMenuItemImage(requestId, i, null, 'error');
        imageGenerationErrorCount++;
      }
    } else {
      console.log(`Skipping image generation for ${item.title} due to previous failures`);
      updateMenuItemImage(requestId, i, null, 'skipped');
    }
  }
  
  // Clean up after 10 minutes to prevent memory leaks
  setTimeout(() => {
    if (imageGenerationStore.menuItems[requestId]) {
      console.log(`Cleaning up request ${requestId} from memory`);
      delete imageGenerationStore.menuItems[requestId];
    }
  }, 10 * 60 * 1000);
}

// Helper to update a specific menu item's image
function updateMenuItemImage(requestId, index, imageUrl, status) {
  if (!imageGenerationStore.menuItems[requestId]) return;
  
  const items = [...imageGenerationStore.menuItems[requestId]];
  if (index >= 0 && index < items.length) {
    items[index] = {
      ...items[index],
      imageUrl,
      imageStatus: status
    };
    imageGenerationStore.menuItems[requestId] = items;
  }
}

// Helper to update all menu items' status
function updateMenuItemsStatus(requestId, status) {
  if (!imageGenerationStore.menuItems[requestId]) return;
  
  const items = imageGenerationStore.menuItems[requestId].map(item => ({
    ...item,
    imageStatus: status
  }));
  
  imageGenerationStore.menuItems[requestId] = items;
}

// Prewarm the API to reduce initial request latency
async function prewarmAPI() {
  console.log('Pre-warming the Nvidia API to reduce initial request latency...');
  const API_URL = process.env.VITE_NVIDIA_API_URL;
  const API_TOKEN = process.env.VITE_NVIDIA_API_TOKEN;
  const MODEL = process.env.VITE_NVIDIA_MODEL;
  
  if (!API_URL || !API_TOKEN || !MODEL) {
    console.log('Missing API configuration, skipping pre-warming');
    return;
  }
  
  try {
    // Send a minimal request to initialize the model
    await axios.post(
      API_URL,
      {
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: 'Hello'
          }
        ],
        max_tokens: 10,
        temperature: 0.5,
        top_p: 0.95,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 120000,
        httpsAgent: httpsAgentNoKeepAlive // Use custom agent
      }
    );
    console.log('Pre-warming complete! API should respond faster to actual requests now.');
    prewarmDoneSuccessfully = true; // Set flag on successful pre-warm
  } catch (error) {
    console.log('Pre-warming attempt failed:', error.message);
    console.log('This is normal - the first actual request may still be slow.');
  }
}

// Extract menu items from LLM response
function extractMenuItems(response) {
  try {
    const content = response.choices[0].message.content;
    console.log('Extracted content:', content);
    
    // Extract JSON array from the response content
    const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
    if (jsonMatch) {
      const jsonString = jsonMatch[0];
      try {
        const menuItems = JSON.parse(jsonString);
        return menuItems;
      } catch (e) {
        console.error('Error parsing JSON:', e);
        return [];
      }
    } else {
      console.log('No JSON array found in response content');
      return [];
    }
  } catch (error) {
    console.error('Error extracting menu items:', error);
    return [];
  }
}

// Add this function to inspect base64 image responses
function isValidBase64(str) {
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  // Check if it's a string and matches base64 pattern
  return typeof str === 'string' && base64Regex.test(str);
}

// Generate a food image using Stable Diffusion API
async function generateFoodImage(description) {
  try {
    // Check if the API token is available
    if (!process.env.VITE_NVIDIA_API_TOKEN) {
      console.log('No Nvidia API token found. Skipping image generation.');
      return null;
    }
    
    // Keep the Stable Diffusion v3 endpoint unchanged as requested
    const invokeUrl = "https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3-medium";
    
    // Create a concise prompt for better results
    const prompt = `A delicious ${description}. Professional food photograph, high quality`;
    
    console.log(`Generating image for: ${prompt}`);
    
    // Use the correct payload format for Stable Diffusion 3 API
    // According to the error message, it requires 'prompt' and doesn't accept text_prompts, model_id, etc.
    const payload = {
      "prompt": prompt,
      "negative_prompt": "blurry, text, watermark, low quality, distorted, ugly food",
      "aspect_ratio": "1:1",
      "seed": 0,
      "steps": 20,
      "cfg_scale": 5
    };
    
    console.log('Sending payload to Stable Diffusion API:', JSON.stringify(payload, null, 2));
    
    try {
      // Use axios with error handling
      const response = await axios.post(
        invokeUrl,
        payload,
        {
          headers: {
            "Authorization": `Bearer ${process.env.VITE_NVIDIA_API_TOKEN}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          timeout: 60000, // 60 second timeout
          validateStatus: false, // Don't throw errors for non-2xx status codes
          httpsAgent: httpsAgentNoKeepAlive // Use custom agent
        }
      );
      
      console.log('Stable Diffusion API response status:', response.status);
      
      // Handle non-200 responses
      if (response.status !== 200) {
        const errorData = response.data ? JSON.stringify(response.data, null, 2) : 'No error details available';
        console.error(`API Error (${response.status}): ${errorData}`);
        return null;
      }
      
      // Log response structure and keys for debugging
      if (response.data) {
        console.log('Response keys:', Object.keys(response.data));
        const preview = JSON.stringify(response.data).substring(0, 200) + '...';
        console.log('Response preview:', preview);
      }
      
      // Handle response format specifically for SD3 Medium which returns { image: "base64data" }
      if (response.data && response.data.image) {
        console.log('Found image data of length:', response.data.image.length);
        
        // Log first 100 chars of the base64 string for debugging
        const imageSample = response.data.image.substring(0, 100) + '...';
        console.log('Image data sample:', imageSample);
        
        // Check if the image data appears to be valid base64 (first few chars)
        const validBase64Check = response.data.image.substring(0, 10);
        console.log('Valid base64 check:', isValidBase64(validBase64Check));
        
        // This is the correct format: data:image/jpeg;base64,[actual_base64_data]
        return `data:image/jpeg;base64,${response.data.image}`;
      }
      
      // Fallback to other formats if the above doesn't match
      if (response.data && response.data.output && response.data.output.length > 0) {
        console.log('Successfully generated image from output field');
        return response.data.output[0];
      } else if (response.data && typeof response.data === 'string') {
        console.log('Successfully generated image from direct response');
        return response.data;
      } else if (response.data && response.data.images && response.data.images.length > 0) {
        console.log('Successfully generated image from images array');
        return response.data.images[0];
      }
      
      console.log('Could not find image in response. Full response:', JSON.stringify(response.data, null, 2));
      return null;
      
    } catch (apiError) {
      console.error('API request error:', apiError.message);
      if (apiError.response) {
        console.error('Response status:', apiError.response.status);
        console.error('Response data:', JSON.stringify(apiError.response.data, null, 2));
      }
      return null;
    }
  } catch (error) {
    console.error('Error generating food image:', error.message);
    return null;
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
  // Pre-warm the API after server starts
  prewarmAPI();
}); 