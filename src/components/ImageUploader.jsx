import React, { useState, useRef } from 'react';

const ImageUploader = ({ onImageUpload, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file) => {
    if (file.type.startsWith('image/')) {
      // Create preview
      const fileUrl = URL.createObjectURL(file);
      setPreviewUrl(fileUrl);
      // Pass file to parent component
      onImageUpload(file);
    } else {
      alert('Please upload an image file');
    }
  };

  // Click handler for the div to open file selector
  const openFileSelector = () => {
    if (!isLoading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Hidden file input, not receiving mouse events directly */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
        disabled={isLoading}
        tabIndex="-1"
      />
      
      {/* Custom drop zone area that will trigger the file input */}
      <div 
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 shadow-lg hover:shadow-2xl ${
          dragActive 
            ? 'border-cyan-400 bg-cyan-900/20 scale-105' 
            : 'border-cyan-500/50 hover:border-cyan-400 hover:bg-cyan-900/10'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileSelector}
        role="button"
        tabIndex="0"
        aria-label="Upload menu image"
      >
        {previewUrl ? (
          <div className="relative">
            <img 
              src={previewUrl} 
              alt="Preview" 
              className="max-h-60 mx-auto rounded-lg object-cover shadow-xl transition-transform duration-300 hover:scale-105" 
            />
            <p className="mt-4 text-cyan-300 font-medium">
              {isLoading ? 'Analyzing image...' : 'Click or drag to replace'}
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-6">
            <div className="bg-gradient-to-r from-cyan-500 to-green-400 p-1 rounded-full w-24 h-24 mx-auto">
              <div className="bg-indigo-900/70 rounded-full w-full h-full flex items-center justify-center">
                <svg 
                  className="h-12 w-12 text-cyan-300" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth="2" 
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            </div>
            <div>
              <p className="text-xl font-semibold text-cyan-300 mb-2">Drag & drop a menu image here or click to browse</p>
              <p className="text-cyan-200 text-sm">Supports JPG, PNG (Max 5MB)</p>
            </div>
          </div>
        )}
        
        {isLoading && (
          <div className="absolute inset-0 bg-indigo-900/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl">
            <div className="animate-spin rounded-full h-14 w-14 border-4 border-cyan-400 border-t-transparent mb-4"></div>
            <p className="text-cyan-300 text-lg font-medium">Processing your menu...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUploader; 