import axios from 'axios';

// Local proxy server URL
const PROXY_URL = 'http://localhost:3001/api/analyze-menu';
const POLL_URL = 'http://localhost:3001/api/menu-images';

// Enable for debug logging
const DEBUG = true;

// Converts image to base64 for API transmission
const convertImageToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

// Extracts menu items from image using LLM API
export const extractMenuItems = async (imageFile) => {
  try {
    if (DEBUG) console.log('Starting extractMenuItems with file:', imageFile.name);
    
    const base64Image = await convertImageToBase64(imageFile);
    if (DEBUG) console.log(`Converted image to base64, length: ${base64Image.length} chars`);
    
    if (base64Image.length > 180000) {
      throw new Error("Image is too large. Please upload a smaller image (max 180KB).");
    }
    
    const prompt = `Analyze this restaurant menu image carefully. Extract all menu items and create a JSON array where each item is an object with 'title' and 'description' fields. Format your response as: [{"title":"Dish Name", "description":"Dish description"}]. Only include this JSON array in your response.`;
    
    if (DEBUG) {
      console.log('Using proxy URL:', PROXY_URL);
      console.log('Prompt:', prompt);
    }
    
    try {
      // Send request to our proxy server with proper timeout
      const response = await axios.post(PROXY_URL, {
        image: base64Image,
        prompt: prompt
      }, {
        timeout: 120000 // Increased to 120 seconds to account for image generation
      });
      
      if (DEBUG) console.log('API response received with menu items and loading state for images');
      
      // Get the initial menu items with requestId
      const { requestId, menuItems } = response.data;
      
      if (requestId && menuItems && menuItems.length > 0 && menuItems.length <= 5) {
        // Start polling for image updates if there are 5 or fewer items
        startPollingForImages(requestId, menuItems, updateCallback);
      }
      
      // Return the initial menu items
      return menuItems;
      
    } catch (axiosError) {
      if (DEBUG) {
        console.log('Axios error:', axiosError);
        if (axiosError.response) {
          console.log('Response status:', axiosError.response.status);
          console.log('Response data:', axiosError.response.data);
        }
      }
      
      // If it's a timeout, provide a more specific error
      if (axiosError.message.includes('timeout')) {
        throw new Error('The menu analysis and image generation is taking too long. Please try again with a clearer image.');
      }
      
      throw axiosError;
    }
    
  } catch (error) {
    console.error('Error extracting menu items:', error);
    throw error;
  }
};

// Global callback for menu item updates - will be set by App component
let updateCallback = null;

// Set the update callback function
export const setMenuItemsUpdateCallback = (callback) => {
  updateCallback = callback;
};

// Poll for menu item updates
const startPollingForImages = (requestId, initialItems, callback) => {
  if (DEBUG) console.log(`Starting to poll for images, requestId: ${requestId}`);
  
  // Track if all items are done loading
  let allDone = false;
  
  // Poll every 2 seconds
  const pollInterval = setInterval(async () => {
    try {
      const response = await axios.get(`${POLL_URL}/${requestId}`);
      
      if (DEBUG) console.log('Poll response:', response.data);
      
      const { menuItems } = response.data;
      
      if (menuItems) {
        // Check if we're done polling (all items have non-loading status)
        allDone = menuItems.every(item => item.imageStatus !== 'loading');
        
        // Call the update callback
        if (callback) callback(menuItems);
        
        // Stop polling when all images are done
        if (allDone) {
          if (DEBUG) console.log('All images processed, stopping polling');
          clearInterval(pollInterval);
        }
      }
    } catch (error) {
      console.error('Error polling for image updates:', error);
      // Stop polling on error
      clearInterval(pollInterval);
    }
  }, 2000);
  
  // Stop polling after 2 minutes as a safety measure
  setTimeout(() => {
    if (!allDone) {
      if (DEBUG) console.log('Polling timeout reached, stopping polling');
      clearInterval(pollInterval);
    }
  }, 120000);
}; 