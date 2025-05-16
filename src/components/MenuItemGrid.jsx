import React from 'react';
import MenuItemCard from './MenuItemCard';

const MenuItemGrid = ({ menuItems }) => {
  if (!menuItems || menuItems.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
      {menuItems.map((item, index) => (
        <MenuItemCard 
          key={index}
          title={item.title}
          description={item.description}
        />
      ))}
    </div>
  );
};

export default MenuItemGrid; 