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
        <div className="w-full h-full flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-2"></div>
          <span className="text-gray-500 text-sm">Generating image...</span>
        </div>
      );
    } else if (imageUrl && !imageError) {
      return (
        <img 
          src={imageUrl} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          onError={handleImageError}
        />
      );
    } else {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
          <span className="text-gray-400 mb-2">{getImagePlaceholderMessage()}</span>
          {imageStatus === 'failed' && (
            <span className="text-gray-500 text-sm">API was unable to generate an image for this dish</span>
          )}
          {imageStatus === 'skipped' && (
            <span className="text-gray-500 text-sm">Images are generated for menus with 5 or fewer items</span>
          )}
        </div>
      );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="w-full h-48 overflow-hidden bg-gray-100">
        {renderImageContent()}
      </div>
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 mb-3">{description}</p>
        {imageUrl && imageError && (
          <p className="text-red-500 text-xs">Error loading image</p>
        )}
      </div>
    </div>
  );
};

export default MenuItemCard; 