import axios from 'axios';

// Get environment variables
const API_URL = import.meta.env.VITE_NVIDIA_API_URL;
const API_TOKEN = import.meta.env.VITE_NVIDIA_API_TOKEN;
const MODEL = import.meta.env.VITE_NVIDIA_MODEL;

// Local proxy server URL
const PROXY_URL = 'http://localhost:3001/api/analyze-menu';

// Enable for debug logging
const DEBUG = true;

// Use mock data for development and testing
const USE_MOCK_DATA = false;

// Mock data for fallback and testing
const MOCK_MENU_ITEMS = [
  { title: "Guacamole", description: "Fresh avocados with tomatoes, onions, and lime" },
  { title: "Nachos", description: "Tortilla chips with cheese, jalapeños, and sour cream" },
  { title: "Tacos", description: "Corn tortillas with your choice of meat, onions, and cilantro" },
  { title: "Quesadilla", description: "Flour tortilla filled with cheese and grilled to perfection" }
];

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
    
    // If using mock data, return immediately
    if (USE_MOCK_DATA) {
      if (DEBUG) console.log('Using mock data instead of API call');
      return MOCK_MENU_ITEMS;
    }
    
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
      // Send request to our proxy server instead of directly to Nvidia
      const response = await axios.post(PROXY_URL, {
        image: base64Image,
        prompt: prompt
      });
      
      if (DEBUG) console.log('API response received:', response.data);
      
      // Extract content from the response
      const content = response.data.choices[0].message.content;
      if (DEBUG) console.log('Response content:', content);
      
      // Extract JSON array from the response content
      const jsonMatch = content.match(/\[\s*\{.*\}\s*\]/s);
      if (jsonMatch) {
        const jsonString = jsonMatch[0];
        if (DEBUG) console.log('Extracted JSON string:', jsonString);
        try {
          const menuItems = JSON.parse(jsonString);
          return menuItems;
        } catch (e) {
          if (DEBUG) console.log('Error parsing JSON:', e);
          throw new Error("Could not parse menu items from response");
        }
      } else {
        if (DEBUG) console.log('No JSON array found in response content');
        throw new Error("Could not extract menu items from response");
      }
      
    } catch (axiosError) {
      if (DEBUG) {
        console.log('Axios error:', axiosError);
        if (axiosError.response) {
          console.log('Response status:', axiosError.response.status);
          console.log('Response data:', axiosError.response.data);
        }
      }
      throw axiosError;
    }
    
  } catch (error) {
    console.error('Error extracting menu items:', error);
    throw error;
  }
}; 