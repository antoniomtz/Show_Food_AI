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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-indigo-900 py-12 px-4 sm:px-6 lg:px-8 text-white">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
          </div>
          <h1 className="text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-500">
            Transform Menus into Visual Delights
          </h1>
          <p className="text-xl text-cyan-100 max-w-2xl mx-auto">
            Upload a photo of any menu and our AI will recognize the text and generate
            mouth-watering images of the dishes.
          </p>
        </div>
        
        <ImageUploader onImageUpload={handleImageUpload} isLoading={isLoading} />
        
        {isLoading && (
          <div className="mt-10 text-center">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-14 w-14 border-t-2 border-b-2 border-cyan-400"></div>
              <p className="text-xl font-medium text-cyan-300">{loadingStage}</p>
              <p className="text-cyan-200 max-w-md">
                Please wait while our AI works its magic on your menu.
              </p>
            </div>
          </div>
        )}
        
        {error && (
          <div className="mt-8 text-center">
            <div className="bg-red-900/40 p-4 rounded-lg border border-red-500 inline-block">
              <p className="text-red-300 mb-1">⚠️ Error</p>
              <p className="text-red-100">{error}</p>
            </div>
          </div>
        )}
        
        {menuItems && (
          <div className="mt-16">
            <h2 className="text-3xl font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-green-400">
              Your Menu Items
            </h2>
            {loadingStage && (
              <p className="text-center text-cyan-300 mb-6 animate-pulse">
                {loadingStage}
              </p>
            )}
            {menuItems.length > 5 && (
              <div className="text-center mb-8 p-3 bg-amber-900/30 rounded-lg border border-amber-500/50 max-w-2xl mx-auto">
                <p className="text-amber-300">
                  <span className="font-semibold">Note:</span> This menu has more than 5 items. AI images were not generated to avoid long processing times.
                </p>
              </div>
            )}
            <MenuItemGrid menuItems={menuItems} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App; 