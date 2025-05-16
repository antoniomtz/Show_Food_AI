import React, { useState, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import MenuItemGrid from './components/MenuItemGrid';
import { extractMenuItems, setMenuItemsUpdateCallback, setProgressCallback } from './api/menuApiService';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [menuItems, setMenuItems] = useState(null);
  const [error, setError] = useState(null);
  const [processingTime, setProcessingTime] = useState(0);
  const [isFirstVisit, setIsFirstVisit] = useState(true);
  
  // Check if this is the first visit
  useEffect(() => {
    const hasVisited = localStorage.getItem('hasVisitedBefore');
    if (hasVisited) {
      setIsFirstVisit(false);
    } else {
      localStorage.setItem('hasVisitedBefore', 'true');
    }
    
    // Auto-dismiss first visit notice after 10 seconds
    if (isFirstVisit) {
      const timer = setTimeout(() => {
        setIsFirstVisit(false);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [isFirstVisit]);
  
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
    
    // Register callback for API progress updates
    setProgressCallback((message) => {
      setLoadingStage(message);
    });
    
    // Introduce a small delay on initial app load before allowing API calls
    // This is a one-time effect on component mount
    const initialLoadTimer = setTimeout(() => {
      // You could set a state here like setIsAppReady(true) if needed,
      // but for just a delay, this is enough.
      console.log('App ready after initial short delay.');
    }, 200); // 200ms delay

    return () => {
      setMenuItemsUpdateCallback(null);
      setProgressCallback(null);
      clearTimeout(initialLoadTimer); // Clear timeout on unmount
    };
  }, []); // Empty dependency array means this runs once on mount

  const handleImageUpload = async (imageFile) => {
    setIsLoading(true);
    setLoadingStage('Initializing analysis...'); // New initial stage
    setError(null);
    setMenuItems(null);
    setProcessingTime(0);
    
    // Start a timer to show processing time
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setProcessingTime(elapsed);
    }, 1000);
    
    try {
      console.log("Processing image:", imageFile.name);
      
      // Call the API with the image
      const extractedItems = await extractMenuItems(imageFile);
      
      // Clear the timer
      clearInterval(timer);
      
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
      // Clear the timer
      clearInterval(timer);
      
      console.error('Error processing menu:', err);
      setError(`Failed to process the menu image: ${err.message || 'Please try again with a clearer image'}`);
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  // Function to refresh the page
  const handleRefresh = () => {
    window.location.reload();
  };
  
  // Dismiss the first visit notice
  const dismissFirstVisitNotice = () => {
    setIsFirstVisit(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-indigo-900 py-12 px-4 sm:px-6 lg:px-8 text-white">
      <div className="max-w-5xl mx-auto">
        {isFirstVisit && (
          <div className="mb-8 p-4 rounded-lg bg-blue-900/50 border border-blue-500/50 shadow-lg">
            <div className="flex items-start">
              <div className="flex-1">
                <h3 className="font-bold text-blue-300 flex items-center">
                  <i className="fas fa-info-circle mr-2"></i>
                  First-time Visit Notice
                </h3>
                <p className="mt-2 text-blue-100">
                  The first image analysis may take up to 2 minutes as our AI system initializes.
                  Subsequent analyses will be much faster! If your first request times out, 
                  please try again - the system will already be warmed up.
                </p>
              </div>
              <button 
                onClick={dismissFirstVisitNotice}
                className="text-blue-300 hover:text-white"
                aria-label="Dismiss notice"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>
        )}
        
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
          </div>
          <h1 className="text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-500 flex items-center justify-center">
            <i className="fas fa-utensils text-cyan-400 mr-4"></i>
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
              {processingTime > 45 && (
                <div className="bg-indigo-900/50 border border-cyan-500/30 p-4 rounded-lg mt-4 max-w-lg mx-auto">
                  <p className="text-cyan-300 mb-2">This is taking longer than usual.</p>
                  <p className="text-cyan-200 text-sm mb-4">
                    The first request to our AI service can sometimes take extra time to initialize.
                    If this continues for more than 90 seconds, you can try refreshing and uploading again.
                  </p>
                  <button 
                    onClick={handleRefresh}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md transition-colors"
                  >
                    Refresh Page
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {error && (
          <div className="mt-8 text-center">
            <div className="bg-red-900/40 p-4 rounded-lg border border-red-500 inline-block">
              <p className="text-red-300 mb-1">⚠️ Error</p>
              <p className="text-red-100">{error}</p>
              {error.includes('taking too long') && (
                <button 
                  onClick={handleRefresh}
                  className="mt-4 px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-md transition-colors"
                >
                  Refresh Page
                </button>
              )}
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