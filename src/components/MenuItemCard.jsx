import React, { useState } from 'react';

const MenuItemCard = ({ title, description, imageUrl, imageStatus }) => {
  const [imageError, setImageError] = useState(false);
  
  const handleImageError = (e) => {
    console.error(`Error loading image for ${title}:`, e);
    setImageError(true);
  };

  // Determine what message to show when there's no image
  const getImagePlaceholderMessage = () => {
    if (imageStatus === 'loading') {
      return null; // No message when loading
    } else if (imageStatus === 'skipped') {
      return 'Image generation skipped (too many items)';
    } else if (imageStatus === 'failed' || imageStatus === 'error') {
      return 'Image generation failed';
    } else {
      return 'No image available';
    }
  };
  
  // Render loading spinner or image or placeholder
  const renderImageContent = () => {
    if (imageStatus === 'loading') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-800/30">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-400 border-t-transparent mb-3"></div>
          <span className="text-cyan-300 text-sm font-medium">Generating delicious image...</span>
        </div>
      );
    } else if (imageUrl && !imageError) {
      return (
        <img 
          src={imageUrl} 
          alt={title} 
          className="w-full h-full object-cover transition-all duration-500 hover:scale-110 hover:rotate-1"
          onError={handleImageError}
        />
      );
    } else {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-indigo-800/20">
          <svg 
            className="w-16 h-16 text-cyan-400/60 mb-3" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="1.5" 
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span className="text-cyan-300 mb-2 font-medium">{getImagePlaceholderMessage()}</span>
          {imageStatus === 'failed' && (
            <span className="text-cyan-200/80 text-sm">API was unable to generate an image for this dish</span>
          )}
          {imageStatus === 'skipped' && (
            <span className="text-cyan-200/80 text-sm">Images are generated for menus with 5 or fewer items</span>
          )}
        </div>
      );
    }
  };

  return (
    <div className="bg-gradient-to-b from-indigo-800/40 to-indigo-900/60 rounded-xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] backdrop-blur-sm border border-cyan-500/20">
      <div className="w-full h-56 overflow-hidden">
        {renderImageContent()}
      </div>
      <div className="p-6">
        <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-green-300 mb-3">{title}</h3>
        <p className="text-cyan-100 mb-3">{description}</p>
        {imageUrl && imageError && (
          <div className="mt-2 p-2 bg-red-900/30 rounded border border-red-500/30">
            <p className="text-red-300 text-xs">Error loading image</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MenuItemCard; 