export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  res.status(200).json({
    subscriptionKey: process.env.AZURE_MAPS_SUBSCRIPTION_KEY
  });
}
