import React from 'react';
import {
  Box,
  Pagination as MuiPagination,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';

interface PaginationProps {
  page: number;
  size: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPageChange: (page: number) => void;
  onSizeChange: (size: number) => void;
  sizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  size,
  total,
  totalPages,
  onPageChange,
  onSizeChange,
  sizeOptions = [10, 20, 50, 100],
}) => {
  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    onPageChange(value);
  };

  const handleSizeChange = (event: any) => {
    onSizeChange(parseInt(event.target.value));
  };

  const startItem = (page - 1) * size + 1;
  const endItem = Math.min(page * size, total);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Showing {startItem}-{endItem} of {total} results
        </Typography>
        <FormControl size="small" sx={{ minWidth: 80 }}>
          <InputLabel>Per page</InputLabel>
          <Select
            value={size}
            label="Per page"
            onChange={handleSizeChange}
          >
            {sizeOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>
      
      <MuiPagination
        count={totalPages}
        page={page}
        onChange={handlePageChange}
        color="primary"
        showFirstButton
        showLastButton
        disabled={totalPages <= 1}
      />
    </Box>
  );
};

export default Pagination;
