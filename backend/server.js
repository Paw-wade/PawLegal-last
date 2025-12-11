const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');

// Charger les variables d'environnement
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3004',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Connexion à MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.error('❌ MONGODB_URI n\'est pas défini dans le fichier .env');
      process.exit(1);
    }
    
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    
    console.log(`✅ MongoDB connecté : ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Erreur de connexion MongoDB:', error.message);
    
    if (error.message.includes('whitelist') || error.message.includes('IP')) {
      console.error('\n💡 Solution:');
      console.error('   1. Allez sur https://cloud.mongodb.com/');
      console.error('   2. Sélectionnez votre cluster');
      console.error('   3. Cliquez sur "Network Access" dans le menu de gauche');
      console.error('   4. Cliquez sur "Add IP Address"');
      console.error('   5. Cliquez sur "Add Current IP Address" ou ajoutez 0.0.0.0/0 pour autoriser toutes les IPs (moins sécurisé)');
    }
    
    process.exit(1);
  }
};

// Routes
app.get('/', (req, res) => {
  res.json({ 
    success: true,
    message: 'API Cabinet Juridique est en ligne',
    version: '1.0.0'
  });
});

// Routes API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/contact', require('./routes/contact'));

// Routes de permissions
try {
  if (require.resolve('./routes/permissions')) {
    app.use('/api/permissions', require('./routes/permissions'));
    console.log('✅ Route /api/permissions enregistrée');
  }
} catch (e) {
  console.log('⚠️ Route /api/permissions non trouvée');
}

// Routes supplémentaires (si les fichiers existent)
// IMPORTANT: Les routes spécifiques doivent être montées AVANT les routes génériques
// pour éviter que les routes paramétrées (/:id) capturent les routes spécifiques
try {
  if (require.resolve('./routes/dossiers')) {
    app.use('/api/user/dossiers', require('./routes/dossiers'));
    console.log('✅ Route /api/user/dossiers enregistrée');
  }
} catch (e) {}

try {
  if (require.resolve('./routes/documents')) {
    app.use('/api/user/documents', require('./routes/documents'));
    console.log('✅ Route /api/user/documents enregistrée');
  }
} catch (e) {
  console.log('⚠️ Route /api/user/documents non trouvée');
}

// Route /api/user doit être montée APRÈS les routes spécifiques
app.use('/api/user', require('./routes/user'));
console.log('✅ Route /api/user enregistrée'); // Debug log

// Route des tâches
try {
  if (require.resolve('./routes/tasks')) {
    app.use('/api/tasks', require('./routes/tasks'));
    console.log('✅ Route /api/tasks enregistrée');
  }
} catch (e) {
  console.log('⚠️ Route /api/tasks non trouvée');
}

try {
  if (require.resolve('./routes/messages')) {
    app.use('/api/messages', require('./routes/messages'));
    console.log('✅ Route /api/messages enregistrée');
  }
} catch (e) {
  console.log('⚠️ Route /api/messages non trouvée');
}

try {
  if (require.resolve('./routes/content')) {
    app.use('/api/content', require('./routes/content'));
  }
} catch (e) {}

// Route appointments
try {
  const appointmentsRouter = require('./routes/appointments');
  app.use('/api/appointments', appointmentsRouter);
  console.log('✅ Route /api/appointments enregistrée');
  // Afficher les routes disponibles pour debug
  console.log('📋 Routes appointments disponibles:');
  appointmentsRouter.stack.forEach((r) => {
    if (r.route) {
      const methods = Object.keys(r.route.methods).join(', ').toUpperCase();
      console.log(`   ${methods} ${r.route.path}`);
    }
  });
} catch (error) {
  console.error('❌ Erreur lors du chargement de la route appointments:', error.message);
  console.error(error.stack);
}

try {
  if (require.resolve('./routes/calculators')) {
    app.use('/api', require('./routes/calculators'));
  }
} catch (e) {}

try {
  if (require.resolve('./routes/temoignages')) {
    app.use('/api/temoignages', require('./routes/temoignages'));
  }
} catch (e) {}

try {
  if (require.resolve('./routes/logs')) {
    const logsRouter = require('./routes/logs');
    app.use('/api/logs', logsRouter);
    console.log('✅ Route /api/logs enregistrée');
    // Afficher les routes disponibles pour debug
    console.log('📋 Routes logs disponibles:');
    logsRouter.stack.forEach((r) => {
      if (r.route) {
        const methods = Object.keys(r.route.methods).join(', ').toUpperCase();
        console.log(`   ${methods} ${r.route.path}`);
      }
    });
  }
} catch (e) {
  console.error('❌ Erreur lors du chargement de la route logs:', e.message);
}

try {
  if (require.resolve('./routes/notifications')) {
    app.use('/api/notifications', require('./routes/notifications'));
    console.log('✅ Route /api/notifications enregistrée');
  }
} catch (e) {
  console.log('⚠️ Route /api/notifications non trouvée');
}

try {
  if (require.resolve('./routes/creneaux')) {
    app.use('/api/creneaux', require('./routes/creneaux'));
    console.log('✅ Route /api/creneaux enregistrée');
  }
} catch (e) {
  console.log('⚠️ Route /api/creneaux non trouvée');
}

// Middleware de gestion d'erreurs (doit être après les routes)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Route 404
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.path,
    method: req.method
  });
});

// Fonction pour vérifier si un port est disponible
const checkPort = (port) => {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.listen(port, () => {
      server.once('close', () => {
        resolve(true);
      });
      server.close();
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
};

// Fonction pour libérer le port
const freePort = async (port) => {
  try {
    const { killPort } = require('./scripts/kill-port');
    console.log(`🔧 Tentative de libération du port ${port}...`);
    await killPort(port);
    // Attendre un peu pour que le port soit libéré
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la libération du port:', error);
    return false;
  }
};

// Fonction pour démarrer le serveur
const startServer = async () => {
  try {
    // Connecter à MongoDB
    await connectDB();
    
    // Démarrer le serveur
    const PORT = process.env.PORT || 3005;
    
    // Vérifier si le port est disponible
    const portAvailable = await checkPort(PORT);
    
    if (!portAvailable) {
      console.log(`⚠️ Le port ${PORT} est déjà utilisé. Tentative de libération...`);
      const freed = await freePort(PORT);
      
      if (!freed) {
        console.error(`❌ Impossible de libérer le port ${PORT}`);
        console.error(`💡 Solutions:`);
        console.error(`   1. Arrêtez manuellement le processus utilisant le port ${PORT}`);
        console.error(`   2. Utilisez un autre port en définissant PORT dans .env`);
        console.error(`   3. Exécutez: node scripts/kill-port.js ${PORT}`);
        process.exit(1);
      }
      
      // Vérifier à nouveau
      const portAvailableAfter = await checkPort(PORT);
      if (!portAvailableAfter) {
        console.error(`❌ Le port ${PORT} est toujours utilisé après la tentative de libération`);
        process.exit(1);
      }
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
      console.log(`📡 API disponible sur http://localhost:${PORT}/api`);
    });
    
    // Gérer les erreurs de port
    app.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Erreur: Le port ${PORT} est déjà utilisé`);
        console.error(`💡 Exécutez: node scripts/kill-port.js ${PORT}`);
        process.exit(1);
      } else {
        console.error('❌ Erreur serveur:', error);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('❌ Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
};

// Démarrer le serveur
startServer();

