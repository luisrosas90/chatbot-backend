const fetch = require('node-fetch');

async function testEvolutionApi() {
  const apiUrl = 'http://api.zemog.info';
  const apiKey = 'Jesus88192*';
  const instanceId = '04245600192';
  const phoneNumber = '584245325586';
  const message = 'Prueba de mensaje desde script';

  console.log('Probando conexión con Evolution API...');
  
  try {
    // Intentar enviar un mensaje con el endpoint correcto
    const response = await fetch(`${apiUrl}/message/sendText/${instanceId}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: message,
        delay: 1200,
        linkPreview: false
      })
    });
    
    const data = await response.json();
    console.log('Respuesta:', data);
    
    if (response.status === 404) {
      console.error('ERROR: La URL no existe o no es accesible');
    } else if (!response.ok) {
      console.error(`ERROR: ${response.status} - ${data.message || 'Error desconocido'}`);
    } else {
      console.log('Mensaje enviado exitosamente');
    }
  } catch (error) {
    console.error('Error de conexión:', error.message);
  }
}

testEvolutionApi(); 