import {
  Box,
  Skeleton,
  Card,
  CardContent,
  Grid,
  Typography,
} from '@mui/material';

export default function PageSkeleton() {
  return (
    <Box sx={{ p: 3 }}>
      {/* Header Skeleton */}
      <Box sx={{ mb: 3 }}>
        <Skeleton variant="text" width={200} height={40} />
        <Skeleton variant="text" width={400} height={24} />
      </Box>

      {/* Cards Grid Skeleton */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[1, 2, 3, 4].map((item) => (
          <Grid item xs={12} sm={6} md={3} key={item}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="60%" height={32} />
                <Skeleton variant="text" width="40%" height={24} />
                <Skeleton variant="text" width="80%" height={20} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Table Skeleton */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <Skeleton variant="text" width={150} height={32} />
          </Typography>
          <Box sx={{ overflow: 'hidden' }}>
            {[1, 2, 3, 4, 5].map((item) => (
              <Box key={item} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Skeleton variant="rectangular" width={60} height={40} />
                <Skeleton variant="text" width="20%" height={40} />
                <Skeleton variant="text" width="30%" height={40} />
                <Skeleton variant="text" width="25%" height={40} />
                <Skeleton variant="text" width="15%" height={40} />
                <Skeleton variant="rectangular" width={80} height={32} />
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
