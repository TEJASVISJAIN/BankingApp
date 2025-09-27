import {
  Box,
  Typography,
  Button,
  Paper,
  Container,
  useTheme,
} from '@mui/material';
import { Home, ArrowBack, SearchOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Container maxWidth="md" sx={{ mt: 8 }}>
      <Paper 
        elevation={3} 
        sx={{ 
          p: 6, 
          textAlign: 'center',
          background: `linear-gradient(135deg, ${theme.palette.primary.light}15, ${theme.palette.secondary.light}15)`,
        }}
      >
        <Box sx={{ mb: 4 }}>
          <SearchOff 
            sx={{ 
              fontSize: 120, 
              color: 'primary.main',
              mb: 2,
              opacity: 0.7,
            }} 
          />
          <Typography variant="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
            404
          </Typography>
          <Typography variant="h4" gutterBottom color="text.secondary">
            Page Not Found
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto' }}>
            The page you're looking for doesn't exist or has been moved. 
            Let's get you back on track.
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<Home />}
            onClick={() => navigate('/')}
            sx={{ minWidth: 140 }}
          >
            Go Home
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<ArrowBack />}
            onClick={() => navigate(-1)}
            sx={{ minWidth: 140 }}
          >
            Go Back
          </Button>
        </Box>

        <Box sx={{ mt: 4, p: 2, backgroundColor: 'grey.50', borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">
            If you believe this is an error, please contact support.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
