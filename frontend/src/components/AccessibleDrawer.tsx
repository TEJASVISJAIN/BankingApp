import React, { useEffect, useRef } from 'react';
import {
  Drawer,
  Box,
  IconButton,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Close } from '@mui/icons-material';

interface AccessibleDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  anchor?: 'left' | 'right' | 'top' | 'bottom';
  width?: number | string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const AccessibleDrawer: React.FC<AccessibleDrawerProps> = ({
  open,
  onClose,
  title,
  children,
  anchor = 'right',
  width = 600,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus management
  useEffect(() => {
    if (open) {
      // Store the previously focused element
      previousActiveElement.current = document.activeElement as HTMLElement;
      
      // Focus the drawer when it opens
      setTimeout(() => {
        if (drawerRef.current) {
          const focusableElement = drawerRef.current.querySelector(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          ) as HTMLElement;
          
          if (focusableElement) {
            focusableElement.focus();
          } else {
            drawerRef.current.focus();
          }
        }
      }, 100);
    } else if (previousActiveElement.current) {
      // Return focus to the previously focused element
      previousActiveElement.current.focus();
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
    
    // Trap focus within the drawer
    if (event.key === 'Tab') {
      const focusableElements = drawerRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements && focusableElements.length > 0) {
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
        
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }
  };

  const drawerWidth = isMobile ? '100%' : width;

  return (
    <Drawer
      anchor={anchor}
      open={open}
      onClose={onClose}
      sx={{
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          maxWidth: '90vw',
          height: isMobile ? '100%' : 'auto',
        },
      }}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title}
      aria-describedby={ariaDescribedBy}
    >
      <Box
        ref={drawerRef}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          outline: 'none',
        }}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}
          role="banner"
        >
          <Typography
            variant="h6"
            component="h2"
            id="drawer-title"
            sx={{ flexGrow: 1, mr: 2 }}
          >
            {title}
          </Typography>
          <IconButton
            onClick={onClose}
            aria-label="Close drawer"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
              '&:focus': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: '2px',
              },
            }}
          >
            <Close />
          </IconButton>
        </Box>

        {/* Content */}
        <Box
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            p: 2,
          }}
          role="main"
          aria-labelledby="drawer-title"
        >
          {children}
        </Box>
      </Box>
    </Drawer>
  );
};

export default AccessibleDrawer;
