import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Divider,
} from '@mui/material';
import {
  Security,
  Notifications,
  Palette,
} from '@mui/icons-material';

export default function SettingsPage() {
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure your fraud detection system
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Security color="primary" sx={{ mr: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Security Settings
                </Typography>
              </Box>
              
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Enable real-time fraud detection"
              />
              
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Auto-block high-risk transactions"
              />
              
              <FormControlLabel
                control={<Switch />}
                label="Require manual approval for large amounts"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Notifications color="primary" sx={{ mr: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Notification Settings
                </Typography>
              </Box>
              
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Email alerts for high-risk transactions"
              />
              
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="SMS notifications for critical alerts"
              />
              
              <FormControlLabel
                control={<Switch />}
                label="Daily summary reports"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Palette color="primary" sx={{ mr: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  System Configuration
                </Typography>
              </Box>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Risk Score Threshold"
                    defaultValue="75"
                    helperText="Transactions above this score will be flagged"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Auto-approval Limit"
                    defaultValue="₹10,000"
                    helperText="Amount below which transactions are auto-approved"
                  />
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 3 }} />
              
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="contained">
                  Save Settings
                </Button>
                <Button variant="outlined">
                  Reset to Defaults
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
