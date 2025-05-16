import React, { useState, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import MenuItemGrid from './components/MenuItemGrid';
import { extractMenuItems, setMenuItemsUpdateCallback } from './api/menuApiService';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [menuItems, setMenuItems] = useState(null);
  const [error, setError] = useState(null);
  
  // Set up the update callback for image polling
  useEffect(() => {
    // Register callback for menu item updates from polling
    setMenuItemsUpdateCallback((updatedItems) => {
      console.log('Received updated menu items:', updatedItems);
      setMenuItems(updatedItems);
      
      // Check if all images are done loading
      const allDone = updatedItems.every(item => item.imageStatus !== 'loading');
      if (allDone) {
        setLoadingStage('');
      }
    });
    
    // Cleanup function
    return () => {
      setMenuItemsUpdateCallback(null);
    };
  }, []);

  const handleImageUpload = async (imageFile) => {
    setIsLoading(true);
    setLoadingStage('Analyzing menu image...');
    setError(null);
    setMenuItems(null);
    
    try {
      console.log("Processing image:", imageFile.name);
      
      // Call the API with the image
      const extractedItems = await extractMenuItems(imageFile);
      
      setMenuItems(extractedItems);
      // Now that we have items with loading state, update the loading stage
      if (extractedItems && extractedItems.length > 0) {
        if (extractedItems.length <= 5) {
          setLoadingStage('Menu items extracted. Generating images...');
          // Set loading state to false so cards are shown
          setIsLoading(false);
        } else {
          // Just set everything as complete for large menus
          setLoadingStage('');
          setIsLoading(false);
        }
      } else {
        setLoadingStage('');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error processing menu:', err);
      setError(`Failed to process the menu image: ${err.message || 'Please try again with a clearer image'}`);
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <img 
              src="/assets/logo.png" 
              alt="Menu Analyzer Logo" 
              className="h-64 w-auto" 
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Menu Analyzer</h1>
          <p className="text-gray-600">Upload a photo of a restaurant menu to extract items and generate AI food images</p>
        </div>
        
        <ImageUploader onImageUpload={handleImageUpload} isLoading={isLoading} />
        
        {isLoading && (
          <div className="mt-10 text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="text-gray-700">{loadingStage}</p>
              <p className="text-sm text-gray-500 max-w-md">
                Please wait while we process your menu.
              </p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="mt-6 text-center">
            <p className="text-red-500 mb-3">{error}</p>
          </div>
        )}
        
        {menuItems && (
          <div className="mt-10">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
              Menu Items
            </h2>
            {loadingStage && (
              <p className="text-center text-blue-600 mb-6">
                {loadingStage}
              </p>
            )}
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