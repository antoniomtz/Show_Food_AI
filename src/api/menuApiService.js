import axios from 'axios';

// Local proxy server URL
const PROXY_URL = 'http://localhost:3001/api/analyze-menu';

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
      
      if (DEBUG) console.log('API response received with menu items and generated images');
      
      return response.data;
      
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