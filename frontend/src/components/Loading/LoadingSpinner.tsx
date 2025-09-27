import { Box, CircularProgress, Typography, Fade } from '@mui/material';

interface LoadingSpinnerProps {
  message?: string;
  size?: number;
  fullScreen?: boolean;
}

export default function LoadingSpinner({ 
  message = 'Loading...', 
  size = 40, 
  fullScreen = false 
}: LoadingSpinnerProps) {
  const content = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        ...(fullScreen && {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          zIndex: 9999,
        }),
      }}
    >
      <Fade in timeout={300}>
        <CircularProgress size={size} thickness={4} />
      </Fade>
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );

  return content;
}
