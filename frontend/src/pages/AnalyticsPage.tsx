import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  Assessment,
  TrendingUp,
} from '@mui/icons-material';

export default function AnalyticsPage() {

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
          Analytics Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive fraud analytics and insights
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Assessment color="primary" sx={{ mr: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Fraud Trends
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Advanced analytics coming soon...
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUp color="success" sx={{ mr: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                  Performance Metrics
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Performance analytics coming soon...
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
