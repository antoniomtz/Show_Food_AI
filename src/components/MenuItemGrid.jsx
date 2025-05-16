import React from 'react';
import MenuItemCard from './MenuItemCard';

const MenuItemGrid = ({ menuItems }) => {
  if (!menuItems || menuItems.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
      {menuItems.map((item, index) => (
        <div 
          key={index} 
          className="transform transition duration-500 ease-in-out"
          style={{ 
            animationDelay: `${index * 150}ms`,
            animationFillMode: 'both',
            animation: 'fadeInUp 0.6s ease-out'
          }}
        >
          <MenuItemCard 
            title={item.title}
            description={item.description}
            imageUrl={item.imageUrl}
            imageStatus={item.imageStatus || 'none'}
          />
        </div>
      ))}
      
      {/* Add animation keyframes with a style tag */}
      <style jsx="true">{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default MenuItemGrid; 