const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

// Configuration
const config = {
  port: process.env.PORT || 3001,
  nvidia: {
    apiUrl: 'https://integrate.api.nvidia.com/v1/chat/completions',
    model: 'meta/llama-4-scout-17b-16e-instruct',
    apiToken: process.env.VITE_NVIDIA_API_TOKEN,
    timeout: {
      initial: 180000, // 3 min for first attempt
      retry: 120000    // 2 min for retries
    }
  },
  stableDiffusion: {
    apiUrl: 'https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3-medium',
    timeout: 60000 // 60 seconds
  },
  maxRetries: 2,
  maxMenuItemsForImages: 5
};

// Custom HTTPS agent with keepAlive disabled
const httpsAgent = new https.Agent({ keepAlive: false });

// State management
const state = {
  prewarmDone: false,
  imageStore: {
    menuItems: {},
    getRequestId: () => Math.random().toString(36).substring(2, 15)
  }
};

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    apiHealthy: true, 
    lastSuccessfulRequest: new Date().toISOString() 
  });
});

// Reset connection endpoint
app.post('/api/reset-connection', (req, res) => {
  res.json({ success: true });
});

// Menu analysis endpoint
app.post('/api/analyze-menu', async (req, res) => {
  try {
    // Check if pre-warming was just completed
    if (state.prewarmDone) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      state.prewarmDone = false;
    }
    
    const { image, prompt } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }
    
    try {
      // Process the menu with NVIDIA API
      const apiResponse = await makeAPIRequestWithRetries(
        config.nvidia.apiUrl,
        {
          model: config.nvidia.model,
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
          'Authorization': `Bearer ${config.nvidia.apiToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      );
      
      // Extract menu items from the response
      const menuItems = extractMenuItems(apiResponse.data);
      
      // Generate a request ID and create initial items with loading state
      const requestId = state.imageStore.getRequestId();
      const initialItems = menuItems.map(item => ({
        ...item,
        imageUrl: null,
        imageStatus: 'loading'
      }));
      
      // Store the initial menu items for this request
      state.imageStore.menuItems[requestId] = [...initialItems];
      
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
      return res.status(500).json({ 
        error: 'Failed to process the menu image',
        message: err.message
      });
    }
  } catch (error) {
    res.status(500).json({
      error: error.message,
      details: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    });
  }
});

// Image generation status endpoint
app.get('/api/menu-images/:requestId', (req, res) => {
  const { requestId } = req.params;
  
  if (!state.imageStore.menuItems[requestId]) {
    return res.status(404).json({ error: 'Request not found' });
  }
  
  res.json({
    menuItems: state.imageStore.menuItems[requestId]
  });
});

// Start server
const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  prewarmAPI();
});

// Disable keep-alive completely
server.keepAliveTimeout = 0;

// Helper Functions

// Make API request with retries
async function makeAPIRequestWithRetries(url, data, headers) {
  let retryCount = 0;
  
  while (retryCount <= config.maxRetries) {
    try {
      return await axios.post(url, data, {
        headers,
        timeout: retryCount === 0 ? config.nvidia.timeout.initial : config.nvidia.timeout.retry,
        httpsAgent
      });
    } catch (error) {
      retryCount++;
      
      if (retryCount > config.maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      const waitTime = 2000 * Math.pow(2, retryCount - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Process images in background after text content is sent
async function processImagesInBackground(menuItems, requestId) {
  // Skip image generation if no API token or too many items
  if (!config.nvidia.apiToken) {
    updateMenuItemsStatus(requestId, 'skipped');
    return;
  }
  
  if (menuItems.length > config.maxMenuItemsForImages) {
    updateMenuItemsStatus(requestId, 'skipped');
    return;
  }
  
  // Process each menu item
  let errorCount = 0;
  
  for (let i = 0; i < menuItems.length; i++) {
    const item = menuItems[i];
    
    // Skip further generation if too many errors
    if (errorCount < 2) {
      try {
        const imageUrl = await generateFoodImage(item.description);
        
        if (imageUrl) {
          updateMenuItemImage(requestId, i, imageUrl, 'success');
        } else {
          updateMenuItemImage(requestId, i, null, 'failed');
          errorCount++;
        }
      } catch (err) {
        updateMenuItemImage(requestId, i, null, 'error');
        errorCount++;
      }
    } else {
      updateMenuItemImage(requestId, i, null, 'skipped');
    }
  }
  
  // Clean up after 10 minutes
  setTimeout(() => {
    if (state.imageStore.menuItems[requestId]) {
      delete state.imageStore.menuItems[requestId];
    }
  }, 10 * 60 * 1000);
}

// Update a specific menu item's image
function updateMenuItemImage(requestId, index, imageUrl, status) {
  if (!state.imageStore.menuItems[requestId]) return;
  
  const items = [...state.imageStore.menuItems[requestId]];
  if (index >= 0 && index < items.length) {
    items[index] = {
      ...items[index],
      imageUrl,
      imageStatus: status
    };
    state.imageStore.menuItems[requestId] = items;
  }
}

// Update all menu items' status
function updateMenuItemsStatus(requestId, status) {
  if (!state.imageStore.menuItems[requestId]) return;
  
  const items = state.imageStore.menuItems[requestId].map(item => ({
    ...item,
    imageStatus: status
  }));
  
  state.imageStore.menuItems[requestId] = items;
}

// Pre-warm the API to reduce initial request latency
async function prewarmAPI() {
  if (!config.nvidia.apiToken) {
    return;
  }
  
  try {
    await axios.post(
      config.nvidia.apiUrl,
      {
        model: config.nvidia.model,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
        temperature: 0.5,
        top_p: 0.95,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${config.nvidia.apiToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: config.nvidia.timeout.retry,
        httpsAgent
      }
    );
    state.prewarmDone = true;
  } catch (error) {
    // Silently continue - first real request may be slow
  }
}

// Extract menu items from LLM response
function extractMenuItems(response) {
  try {
    const content = response.choices[0].message.content;
    
    // Extract JSON array from the response content
    const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        return [];
      }
    }
    return [];
  } catch (error) {
    return [];
  }
}

// Check if string is valid base64
function isValidBase64(str) {
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  return typeof str === 'string' && base64Regex.test(str);
}

// Generate a food image using Stable Diffusion API
async function generateFoodImage(description) {
  try {
    if (!config.nvidia.apiToken) {
      return null;
    }
    
    const prompt = `A delicious ${description}. Professional food photograph, high quality`;
    
    const payload = {
      "prompt": prompt,
      "negative_prompt": "blurry, text, watermark, low quality, distorted, ugly food",
      "aspect_ratio": "1:1",
      "seed": 0,
      "steps": 20,
      "cfg_scale": 5
    };
    
    const response = await axios.post(
      config.stableDiffusion.apiUrl,
      payload,
      {
        headers: {
          "Authorization": `Bearer ${config.nvidia.apiToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        timeout: config.stableDiffusion.timeout,
        validateStatus: false,
        httpsAgent
      }
    );
    
    if (response.status !== 200) {
      return null;
    }
    
    // Handle response format specifically for SD3 Medium
    if (response.data && response.data.image) {
      return `data:image/jpeg;base64,${response.data.image}`;
    }
    
    // Fallback to other possible response formats
    if (response.data && response.data.output && response.data.output.length > 0) {
      return response.data.output[0];
    } else if (response.data && typeof response.data === 'string') {
      return response.data;
    } else if (response.data && response.data.images && response.data.images.length > 0) {
      return response.data.images[0];
    }
    
    return null;
  } catch (error) {
    return null;
  }
} 