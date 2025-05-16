import React, { useState } from 'react';
import ImageUploader from './components/ImageUploader';
import MenuItemGrid from './components/MenuItemGrid';
import { extractMenuItems } from './api/menuApiService';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [menuItems, setMenuItems] = useState(null);
  const [error, setError] = useState(null);
  const [useFallbackMode, setUseFallbackMode] = useState(false);

  const handleImageUpload = async (imageFile) => {
    setIsLoading(true);
    setError(null);
    setMenuItems(null);
    
    try {
      console.log("Processing image:", imageFile.name);
      // Call the real API with the image
      const extractedItems = await extractMenuItems(imageFile);
      setMenuItems(extractedItems);
    } catch (err) {
      console.error('Error processing menu:', err);
      const errorMessage = err.message || 'Please try again';
      setError(`Failed to process the menu image: ${errorMessage}`);
      
      // Don't show fallback option for image size errors
      if (!errorMessage.includes("too large")) {
        setUseFallbackMode(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseFallback = () => {
    // Use fallback mock data
    setMenuItems([
      { title: "Guacamole", description: "Fresh avocados with tomatoes, onions, and lime" },
      { title: "Nachos", description: "Tortilla chips with cheese, jalapeños, and sour cream" },
      { title: "Tacos", description: "Corn tortillas with your choice of meat, onions, and cilantro" },
      { title: "Quesadilla", description: "Flour tortilla filled with cheese and grilled to perfection" },
      { title: "Burrito", description: "Large flour tortilla wrapped around beans, rice, and meat" },
      { title: "Enchiladas", description: "Corn tortillas rolled around filling and covered with chili sauce" }
    ]);
    setError(null);
    setUseFallbackMode(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Menu Analyzer</h1>
          <p className="text-gray-600">Upload a photo of a restaurant menu to extract its items</p>
        </div>
        
        <ImageUploader onImageUpload={handleImageUpload} isLoading={isLoading} />
        
        {error && (
          <div className="mt-6 text-center">
            <p className="text-red-500 mb-3">{error}</p>
            {useFallbackMode && (
              <button 
                onClick={handleUseFallback}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Use Demo Mode Instead
              </button>
            )}
          </div>
        )}
        
        {menuItems && !isLoading && (
          <div className="mt-10">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
              Menu Items
            </h2>
            <MenuItemGrid menuItems={menuItems} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App; 