exports.handler = async (event, context) => {
  // Solo permitir GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const projectId = event.queryStringParameters?.projectId || process.env.VITE_STACK_PROJECT_ID;

    if (!projectId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Project ID not provided' }),
      };
    }

    const apiKey = process.env.VITE_NEON_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'API key not configured' }),
      };
    }

    const response = await fetch(`https://console.neon.tech/api/v2/projects/${projectId}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Neon API error: ${errorText}` }),
      };
    }

    const data = await response.json();
    const storageBytes = data.project?.synthetic_storage_size || 0;
    const storageMB = storageBytes / (1024 * 1024);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: JSON.stringify({
        storageMB: storageMB,
        storageBytes: storageBytes,
      }),
    };
  } catch (error) {
    console.error('Error in get-storage function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};