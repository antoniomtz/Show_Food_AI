import React, { useState } from 'react';
import ImageUploader from './components/ImageUploader';
import MenuItemGrid from './components/MenuItemGrid';
import { extractMenuItems } from './api/menuApiService';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [menuItems, setMenuItems] = useState(null);
  const [error, setError] = useState(null);

  const handleImageUpload = async (imageFile) => {
    setIsLoading(true);
    setLoadingStage('Analyzing menu image...');
    setError(null);
    setMenuItems(null);
    
    try {
      console.log("Processing image:", imageFile.name);
      
      // Update loading stage for image generation
      setLoadingStage('Analyzing menu and generating dish images...');
      
      // Call the API with the image
      const extractedItems = await extractMenuItems(imageFile);
      
      setMenuItems(extractedItems);
    } catch (err) {
      console.error('Error processing menu:', err);
      setError(`Failed to process the menu image: ${err.message || 'Please try again with a clearer image'}`);
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Menu Analyzer</h1>
          <p className="text-gray-600">Upload a photo of a restaurant menu to extract items and generate AI food images</p>
          <p className="text-gray-500 text-sm mt-2">Note: AI-generated images are only created for menus with 5 or fewer items</p>
        </div>
        
        <ImageUploader onImageUpload={handleImageUpload} isLoading={isLoading} />
        
        {isLoading && (
          <div className="mt-10 text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="text-gray-700">{loadingStage}</p>
              <p className="text-sm text-gray-500 max-w-md">
                Please wait while we process your menu.
                This might take up to a minute as we extract menu items and generate images.
              </p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="mt-6 text-center">
            <p className="text-red-500 mb-3">{error}</p>
          </div>
        )}
        
        {menuItems && !isLoading && (
          <div className="mt-10">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
              Menu Items
            </h2>
            {menuItems.length > 5 && (
              <p className="text-center text-amber-600 mb-6">
                This menu has more than 5 items. AI images were not generated to avoid long processing times.
              </p>
            )}
            <MenuItemGrid menuItems={menuItems} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App; 