const express    = require('express');
const cors       = require('cors');
const dotenv     = require('dotenv');
const path       = require('path');

const authRoutes         = require('./routes/auth.routes');
const adminRoutes        = require('./routes/admin.routes');
const proposalRoutes     = require('./routes/proposal.routes');
const repositoryRoutes   = require('./routes/repository.routes');
const notificationRoutes = require('./routes/notification.routes');

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth',          authRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/proposals',     proposalRoutes);
app.use('/api/repository',    repositoryRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => res.send('AYON API running'));

app.listen(PORT, () => console.log('Server started on port ' + PORT));