# Menu Analyzer

## Overview

Menu Analyzer is a web application that uses AI to analyze restaurant menu photos. Upload an image of a restaurant menu and get a structured list of menu items with AI-generated images of each dish and its approximate calories.

## Demo (youtube)

<a href="https://www.youtube.com/watch?v=SuvBUBrn4Eg">
  <img src="https://github.com/user-attachments/assets/d981942c-c37c-4d10-a535-0978b10af53f" width="400"/>
</a>

## Features

- NVIDIA NIM APIs (VLLM and Stable Diffusion)
- Photo upload for menu analysis
- AI-powered menu item extraction
- AI-generated food images (for menus with 5 or fewer items)
- Calories calculation via prompt-engineering
- Progressive loading with real-time updates
- Responsive, modern UI built with React and Tailwind CSS
- API prewarming to reduce cold-start latency

## Installation

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Setup

1. Clone the repository:
   ```
   git clone https://github.com/antoniomtz/Show_Food_AI.git
   cd Show_Food_AI
   ```

2. Install dependencies for both frontend and backend:
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with your Nvidia API credentials:
   ```
   VITE_NVIDIA_API_TOKEN=your_api_token
   ```

## Running the Application

1. Start the proxy server:
   ```
   node server.js
   ```

2. In a new terminal, start the frontend development server:
   ```
   npm run dev
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

## How It Works

1. Upload a photo of a restaurant menu
2. The application extracts menu items using an AI model
3. If the menu has 5 or fewer items, AI-generated images are created for each dish
4. Results are displayed as cards with dish name, description, and image

## Performance Notes

- The Stable Diffusion API from NVIDIA NIM has a cold start period. The first couple of image generation calls may be slow, but subsequent calls will be much faster.
- API prewarming is implemented to minimize cold start latency where possible.

## Technologies Used

- **Frontend**: React, Tailwind CSS, Vite
- **Backend**: Node.js, Express
- **AI Services**: Nvidia NIM AI APIs (Menu extraction and image generation)

