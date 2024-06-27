import cors from 'cors';
import express, { Request, Response } from 'express';
import http from 'http';
import mysql from 'mysql';

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cors()); 

// Configuración de la base de datos MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'Gomez',
  password: 'Gomezbga09', 
  database: 'Adivina'
});

connection.connect((err: Error | null) => {
  if (err) {
    console.error('Error al conectar con la base de datos:', err.message);
    return;
  }
  console.log('Conexión exitosa a la base de datos MySQL');
});

// Servir el contenido estático del cliente
app.use(express.static('../Cliente'));

let numeroAleatorio: number | null = null;
let juegoTerminado = false;

let adivinarNumero = (numeroUsuario: number): string => {
  if (juegoTerminado) {
    return 'El juego ha terminado. Esperando que el creador establezca un nuevo número.';
  }
  
  if (numeroAleatorio === null) {
    return 'Esperando a que el creador establezca el número.';
  }

  if (numeroUsuario === numeroAleatorio) {
    juegoTerminado = true;
    let mensaje = '¡Felicidades! ¡Has adivinado el número correcto!';
    notificarClientes({ tipo: 'mensaje', mensaje });
    return mensaje;
  } else if (numeroUsuario < numeroAleatorio) {
    let mensaje = 'El número es más grande. Intenta de nuevo.';
    notificarClientes({ tipo: 'mensaje', mensaje });
    return mensaje;
  } else {
    let mensaje = 'El número es más pequeño. Intenta de nuevo.';
    notificarClientes({ tipo: 'mensaje', mensaje });
    return mensaje;
  }
};

// Listas de clientes SSE
let clients: Array<Response> = [];

// Método SSE
app.get('/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.push(res);

  req.on('close', () => {
    clients = clients.filter(client => client !== res);
    res.end();
  });
});

const notificarClientes = (data: { tipo: string, mensaje: string }) => {
  clients.forEach(client => client.write(`data: ${JSON.stringify(data)}\n\n`));
};

// Rutas para manejar mensajes del creador y adivinador
app.post('/creador', (req: Request, res: Response) => {
  const { numero, nombre } = req.body;
  numeroAleatorio = numero;
  juegoTerminado = false;

  connection.query(
    'INSERT INTO jugadores (nombre, rol) VALUES (?, ?)',
    [nombre, 'creador'],
    (err: Error | null) => {
      if (err) {
        console.error('Error al guardar el creador en la base de datos:', err.message);
      } else {
        console.log('Creador guardado en la base de datos');
      }
    }
  );

  notificarClientes({ tipo: 'notificacion', mensaje: 'Número recibido. Esperando a que alguien intente adivinar.' });
  res.status(201).json({ success: true });
});

app.post('/adivinador', (req: Request, res: Response) => {
  const { numero, nombre } = req.body;

  connection.query(
    'INSERT INTO jugadores (nombre, rol) VALUES (?, ?)',
    [nombre, 'adivinador'],
    (err: Error | null) => {
      if (err) {
        console.error('Error al guardar el adivinador en la base de datos:', err.message);
      } else {
        console.log('Adivinador guardado en la base de datos');
      }
    }
  );

  const mensaje = adivinarNumero(numero);
  notificarClientes({ tipo: 'mensaje', mensaje });
  res.status(201).json({ success: true });
});

// Iniciar el servidor
const puerto: number = 3000;
server.listen(puerto, () => {
  console.log(`Servidor HTTP escuchando en el puerto ${puerto}`);
});


