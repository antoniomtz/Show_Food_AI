import axios from 'axios';
// Note: The 'https' import is for Node.js context and won't directly affect browser keep-alive behavior
// but we keep the structure for consistency if this module were ever used server-side.
import https from 'https'; 

// Local proxy server URL
const PROXY_URL = 'http://localhost:3001/api/analyze-menu';
const POLL_URL = 'http://localhost:3001/api/menu-images';
const HEALTH_URL = 'http://localhost:3001/api/health';
const RESET_URL = 'http://localhost:3001/api/reset-connection';

// Enable for debug logging
const DEBUG = true;

// Global callback for progress updates
let progressCallback = null;

// Create an axios instance for client-side requests
const clientAxiosInstance = axios.create({
  // For Node.js context, this would be effective with a real https.Agent.
  // In the browser, this specific httpsAgent config has no direct effect.
  // Browser connection management is handled by the browser itself.
  httpsAgent: typeof window === 'undefined' ? new https.Agent({ keepAlive: false }) : undefined,
  headers: {
    // Suggesting 'Connection: close' can sometimes influence servers,
    // but modern HTTP/1.1 clients and servers usually manage persistence automatically.
    // For HTTP/2, this header is ignored.
    // 'Connection': 'close' // Generally not recommended for modern clients
  }
});

// Converts image to base64 for API transmission
const convertImageToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

// Set the progress callback function
export const setProgressCallback = (callback) => {
  progressCallback = callback;
};

// Check API health status
export const checkApiHealth = async () => {
  try {
    if (DEBUG) console.log('Checking API health via client instance...');
    const response = await clientAxiosInstance.get(HEALTH_URL);
    return response.data;
  } catch (error) {
    console.error('Error checking API health:', error);
    return { apiHealthy: false, error: error.message }; // Return a consistent error structure
  }
};

// Reset API connection
export const resetApiConnection = async () => {
  try {
    if (DEBUG) console.log('Attempting to reset API connection via client instance...');
    const response = await clientAxiosInstance.post(RESET_URL);
    return response.data;
  } catch (error) {
    console.error('Error resetting API connection:', error);
    return { success: false, error: error.message }; // Return a consistent error structure
  }
};

// Extracts menu items from image using LLM API
export const extractMenuItems = async (imageFile) => {
  try {
    if (DEBUG) console.log('Starting extractMenuItems with file:', imageFile.name);
    
    // Check API health before making the request
    const healthStatus = await checkApiHealth();
    if (DEBUG) console.log('API health status:', healthStatus);
    
    // If the API is not healthy and the last successful request was more than 2 minutes ago
    if (!healthStatus.apiHealthy && (!healthStatus.lastSuccessfulRequest || 
        new Date() - new Date(healthStatus.lastSuccessfulRequest) > 2 * 60 * 1000)) {
      if (DEBUG) console.log('API appears unhealthy, attempting to reset connection');
      await resetApiConnection();
      if (progressCallback) {
        progressCallback('Resetting API connection, this may take a moment...');
      }
    }
    
    // Start progress updates
    let elapsedTime = 0;
    const progressInterval = setInterval(() => {
      elapsedTime += 3;
      
      // Only send specific updates at certain time intervals
      if (progressCallback) {
        if (elapsedTime <= 3) {
          progressCallback('Preparing image for analysis...');
        } else if (elapsedTime <= 10) {
          progressCallback('Sending image to AI model...');
        } else if (elapsedTime <= 20) {
          progressCallback('AI analyzing menu contents (this may take a minute)...');
        } else if (elapsedTime <= 40) {
          progressCallback('Still working on analyzing your menu...');
        } else if (elapsedTime <= 60) {
          progressCallback('Almost there! Processing menu items...');
        } else if (elapsedTime <= 120) {
          progressCallback(`Analysis in progress (${elapsedTime}s elapsed)`);
        } else {
          progressCallback(`This request is taking longer than usual. Consider refreshing and trying again. (${elapsedTime}s elapsed)`);
        }
      }
    }, 3000);
    
    const base64Image = await convertImageToBase64(imageFile);
    if (DEBUG) console.log(`Converted image to base64, length: ${base64Image.length} chars`);
    
    if (base64Image.length > 180000) {
      clearInterval(progressInterval);
      throw new Error("Image is too large. Please upload a smaller image (max 180KB).");
    }
    
    const prompt = `Analyze this restaurant menu image carefully. Extract all menu items and create a JSON array where each item is an object with 'title', 'description', and 'calories' fields. The 'calories' field should be your estimation of the calories in the dish based on the description and assuming a single serving portion. Format your response as: [{"title":"Dish Name", "description":"Dish description", "calories": 450}]. Only include this JSON array in your response.`;
    
    if (DEBUG) {
      console.log('Using proxy URL:', PROXY_URL);
      console.log('Prompt:', prompt);
    }
    
    try {
      // Send request to our proxy server with proper timeout
      const response = await clientAxiosInstance.post(PROXY_URL, {
        image: base64Image,
        prompt: prompt
      }, {
        timeout: 180000 // 3 minute timeout for initial requests
      });
      
      // Stop the progress interval
      clearInterval(progressInterval);
      
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
      // Stop the progress interval
      clearInterval(progressInterval);
      
      if (DEBUG) {
        console.log('Axios error:', axiosError);
        if (axiosError.response) {
          console.log('Response status:', axiosError.response.status);
          console.log('Response data:', axiosError.response.data);
        }
      }
      
      // If it's a timeout, provide a more specific error
      if (axiosError.message.includes('timeout')) {
        // Try to reset the API connection in the background
        resetApiConnection().catch(e => console.error('Error trying to reset connection after timeout:', e));
        
        throw new Error('The menu analysis is taking too long. Please try refreshing the page and uploading the same image again.');
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
      const response = await clientAxiosInstance.get(`${POLL_URL}/${requestId}`);
      
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