import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { FixedSizeList as List } from 'react-window';

interface VirtualizedTableProps {
  data: any[];
  columns: Array<{
    key: string;
    label: string;
    width: number;
    render?: (value: any, row: any) => React.ReactNode;
  }>;
  height?: number;
  loading?: boolean;
  error?: string;
  onRowClick?: (row: any) => void;
  selectedRowId?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

interface RowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    items: any[];
    columns: VirtualizedTableProps['columns'];
    onRowClick?: (row: any) => void;
    selectedRowId?: string;
  };
}

const Row: React.FC<RowProps> = ({ index, style, data }) => {
  const { items, columns, onRowClick, selectedRowId } = data;
  const row = items[index];
  const isSelected = selectedRowId === row.id;

  return (
    <div
      style={style}
      role="row"
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onRowClick?.(row);
        }
      }}
      onClick={() => onRowClick?.(row)}
      style={{
        ...style,
        cursor: onRowClick ? 'pointer' : 'default',
        backgroundColor: isSelected ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        '&:hover': {
          backgroundColor: 'rgba(0, 0, 0, 0.04)',
        },
        '&:focus': {
          outline: '2px solid #1976d2',
          outlineOffset: '-2px',
        },
      }}
    >
      {columns.map((column) => (
        <div
          key={column.key}
          style={{
            width: column.width,
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          role="cell"
        >
          {column.render ? column.render(row[column.key], row) : row[column.key]}
        </div>
      ))}
    </div>
  );
};

const VirtualizedTable: React.FC<VirtualizedTableProps> = ({
  data,
  columns,
  height = 400,
  loading = false,
  error,
  onRowClick,
  selectedRowId,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);

  const itemData = useMemo(() => ({
    items: data,
    columns,
    onRowClick,
    selectedRowId,
  }), [data, columns, onRowClick, selectedRowId]);

  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height={height}
        role="status"
        aria-label="Loading data"
      >
        <CircularProgress />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Loading...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" role="alert" aria-live="polite">
        {error}
      </Alert>
    );
  }

  if (data.length === 0) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height={height}
        role="status"
        aria-label="No data available"
      >
        <Typography variant="body2" color="text.secondary">
          No data available
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer
      component={Paper}
      sx={{ height, width: '100%' }}
      role="table"
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    >
      {/* Table Header */}
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.key}
                style={{
                  width: column.width,
                  minWidth: column.width,
                  maxWidth: column.width,
                }}
                role="columnheader"
                scope="col"
              >
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
      </Table>

      {/* Virtualized Body */}
      <Box sx={{ height: height - 57, width: '100%' }}>
        <List
          height={height - 57}
          itemCount={data.length}
          itemSize={48}
          itemData={itemData}
          width={totalWidth}
          role="table"
          aria-label={`Virtualized table with ${data.length} rows`}
        >
          {Row}
        </List>
      </Box>
    </TableContainer>
  );
};

export default VirtualizedTable;
