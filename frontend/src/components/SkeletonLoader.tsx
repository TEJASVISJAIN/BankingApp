import { Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Box } from '@mui/material'

interface SkeletonLoaderProps {
  rows?: number
  variant?: 'table' | 'card' | 'list'
}

export function SkeletonLoader({ rows = 5, variant = 'table' }: SkeletonLoaderProps) {
  if (variant === 'table') {
    return (
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><Skeleton width={80} height={20} /></TableCell>
              <TableCell><Skeleton width={80} height={20} /></TableCell>
              <TableCell><Skeleton width={80} height={20} /></TableCell>
              <TableCell><Skeleton width={80} height={20} /></TableCell>
              <TableCell><Skeleton width={80} height={20} /></TableCell>
              <TableCell><Skeleton width={80} height={20} /></TableCell>
              <TableCell><Skeleton width={80} height={20} /></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Array.from({ length: rows }).map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton width="60%" height={20} /></TableCell>
                <TableCell><Skeleton width={60} height={24} variant="rectangular" /></TableCell>
                <TableCell><Skeleton width="70%" height={20} /></TableCell>
                <TableCell><Skeleton width="80%" height={20} /></TableCell>
                <TableCell><Skeleton width={80} height={24} variant="rectangular" /></TableCell>
                <TableCell><Skeleton width="90%" height={20} /></TableCell>
                <TableCell><Skeleton width={40} height={40} variant="circular" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    )
  }

  if (variant === 'card') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Array.from({ length: rows }).map((_, index) => (
          <Paper key={index} sx={{ p: 2 }}>
            <Skeleton width="60%" height={24} sx={{ mb: 1 }} />
            <Skeleton width="40%" height={20} />
          </Paper>
        ))}
      </Box>
    )
  }

  if (variant === 'list') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: rows }).map((_, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1 }}>
            <Skeleton width={40} height={40} variant="circular" />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="70%" height={20} />
              <Skeleton width="50%" height={16} />
            </Box>
            <Skeleton width={60} height={24} variant="rectangular" />
          </Box>
        ))}
      </Box>
    )
  }

  return null
}

export default SkeletonLoader
