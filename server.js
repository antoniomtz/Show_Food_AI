const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend requests
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Proxy endpoint for Nvidia API
app.post('/api/analyze-menu', async (req, res) => {
  try {
    console.log('Received request to analyze menu');
    
    const { image, prompt } = req.body;
    
    // Validate inputs
    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }
    
    const API_URL = process.env.VITE_NVIDIA_API_URL;
    const API_TOKEN = process.env.VITE_NVIDIA_API_TOKEN;
    const MODEL = process.env.VITE_NVIDIA_MODEL;
    
    console.log('Using API URL:', API_URL);
    console.log('Using Model:', MODEL);
    
    // Forward the request to Nvidia API
    const response = await axios.post(
      API_URL,
      {
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: `${prompt} <img src="data:image/png;base64,${image}" />`
          }
        ],
        max_tokens: 1024,
        temperature: 0.5,
        top_p: 0.95,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${API_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );
    
    console.log('Received response from Nvidia API');
    
    // Send the response back to client
    res.json(response.data);
  } catch (error) {
    console.error('Error in proxy server:', error);
    
    // Send detailed error information
    res.status(500).json({
      error: error.message,
      details: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
}); 