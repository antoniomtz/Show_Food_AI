import axios from 'axios';

// API endpoints configuration
const API_CONFIG = {
  baseUrl: 'http://localhost:3001/api',
  endpoints: {
    analyzeMenu: '/analyze-menu',
    pollImages: '/menu-images',
    health: '/health',
    reset: '/reset-connection'
  },
  timeouts: {
    analysis: 180000, // 3 min
    polling: 5000,    // 5 sec
    health: 5000,     // 5 sec
    maxPolling: 120000 // 2 min
  }
};

// State management
const state = {
  debug: false,
  controllers: {
    menuAnalysis: null,
    polling: null
  },
  callbacks: {
    progress: null,
    update: null
  }
};

// Create an axios instance with optimized settings
const apiClient = axios.create({
  headers: {
    'Connection': 'close'
  }
});

/**
 * Utility Functions
 */

// Convert image file to base64
const convertImageToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

// Cancel any active requests
const cancelActiveRequests = () => {
  if (state.controllers.menuAnalysis) {
    state.controllers.menuAnalysis.abort();
    state.controllers.menuAnalysis = null;
  }
  
  if (state.controllers.polling) {
    state.controllers.polling.abort();
    state.controllers.polling = null;
  }
};

/**
 * API Functions
 */

// Set the progress callback function
export const setProgressCallback = (callback) => {
  state.callbacks.progress = callback;
};

// Set the update callback function
export const setMenuItemsUpdateCallback = (callback) => {
  state.callbacks.update = callback;
};

// Check API health status
export const checkApiHealth = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeouts.health);
    
    const response = await apiClient.get(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.health}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.data;
  } catch (error) {
    return { 
      apiHealthy: false, 
      error: error.message
    };
  }
};

// Reset API connection
export const resetApiConnection = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeouts.health);
    
    const response = await apiClient.post(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.reset}`, {}, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.data;
  } catch (error) {
    return { 
      success: false, 
      error: error.message
    };
  }
};

// Poll for menu item image updates
const pollForImages = async (requestId, initialItems) => {
  // Create a new AbortController for polling
  state.controllers.polling = new AbortController();
  
  // Set end time for polling
  const endTime = Date.now() + API_CONFIG.timeouts.maxPolling;
  
  // Define recursive polling function
  const executePoll = async () => {
    // Check if we've exceeded our max polling time
    if (Date.now() > endTime) {
      return;
    }
    
    try {
      const response = await apiClient.get(
        `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.pollImages}/${requestId}`, 
        {
          timeout: API_CONFIG.timeouts.polling,
          signal: state.controllers.polling.signal
        }
      );
      
      const { menuItems } = response.data;
      
      if (menuItems) {
        // Check if we're done polling (all items have non-loading status)
        const allDone = menuItems.every(item => item.imageStatus !== 'loading');
        
        // Call the update callback
        if (state.callbacks.update) {
          state.callbacks.update(menuItems);
        }
        
        // If all done, stop polling
        if (allDone) {
          return;
        }
        
        // Schedule next poll after delay
        setTimeout(executePoll, 2000);
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        return;
      }
      
      // Try one more time after a slightly longer delay
      setTimeout(executePoll, 5000);
    }
  };
  
  // Start the polling process
  executePoll();
};

// Main function to extract menu items from image
export const extractMenuItems = async (imageFile) => {
  try {
    // Cancel any existing in-flight requests first
    cancelActiveRequests();
    
    // Create a new AbortController for this request
    state.controllers.menuAnalysis = new AbortController();
    
    // Check API health before making the request
    const healthStatus = await checkApiHealth();
    
    // Reset connection if needed
    if (!healthStatus.apiHealthy && (!healthStatus.lastSuccessfulRequest || 
        new Date() - new Date(healthStatus.lastSuccessfulRequest) > 2 * 60 * 1000)) {
      await resetApiConnection();
      if (state.callbacks.progress) {
        state.callbacks.progress('Resetting API connection, this may take a moment...');
      }
    }
    
    // Progress updates setup
    let elapsedTime = 0;
    const progressInterval = setInterval(() => {
      elapsedTime += 3;
      
      if (state.callbacks.progress) {
        if (elapsedTime <= 3) {
          state.callbacks.progress('Preparing image for analysis...');
        } else if (elapsedTime <= 10) {
          state.callbacks.progress('Sending image to AI model...');
        } else if (elapsedTime <= 20) {
          state.callbacks.progress('AI analyzing menu contents (this may take a minute)...');
        } else if (elapsedTime <= 40) {
          state.callbacks.progress('Still working on analyzing your menu...');
        } else if (elapsedTime <= 60) {
          state.callbacks.progress('Almost there! Processing menu items...');
        } else if (elapsedTime <= 120) {
          state.callbacks.progress(`Analysis in progress (${elapsedTime}s elapsed)`);
        } else {
          state.callbacks.progress(`This request is taking longer than usual. Consider refreshing and trying again. (${elapsedTime}s elapsed)`);
        }
      }
    }, 3000);
    
    // Process image
    const base64Image = await convertImageToBase64(imageFile);
    
    if (base64Image.length > 180000) {
      clearInterval(progressInterval);
      throw new Error("Image is too large. Please upload a smaller image (max 180KB).");
    }
    
    const prompt = `Analyze this restaurant menu image carefully. Extract all menu items and create a JSON array where each item is an object with 'title', 'description', and 'calories' fields. The 'calories' field should be your estimation of the calories in the dish based on the description and assuming a single serving portion. Format your response as: [{"title":"Dish Name", "description":"Dish description", "calories": 450}]. Only include this JSON array in your response.`;
    
    try {
      // Send request to our proxy server
      const response = await apiClient.post(
        `${API_CONFIG.baseUrl}${API_CONFIG.endpoints.analyzeMenu}`, 
        {
          image: base64Image,
          prompt: prompt
        }, 
        {
          timeout: API_CONFIG.timeouts.analysis,
          signal: state.controllers.menuAnalysis.signal
        }
      );
      
      // Stop the progress interval
      clearInterval(progressInterval);
      
      // Get the initial menu items with requestId
      const { requestId, menuItems } = response.data;
      
      if (requestId && menuItems && menuItems.length > 0 && menuItems.length <= 5) {
        // Start polling for image updates if there are 5 or fewer items
        pollForImages(requestId, menuItems);
      }
      
      // Return the initial menu items
      return menuItems;
      
    } catch (error) {
      // Stop the progress interval
      clearInterval(progressInterval);
      
      // If it's a timeout, provide a more specific error
      if (error.message.includes('timeout') || error.message.includes('aborted')) {
        // Try to reset the API connection in the background
        resetApiConnection().catch(() => {});
        
        throw new Error('The menu analysis is taking too long. Please try refreshing the page and uploading the same image again.');
      }
      
      throw error;
    }
    
  } catch (error) {
    throw error;
  }
}; 