import {
  Box,
  Typography,
  TextField,
  Paper,
  List,
  ListItem,
  IconButton,
  Checkbox,
  Fade,
  CircularProgress,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTodoBroadcast } from '../hooks/useTodoBroadcast';
import { useTheme } from '@mui/material/styles';

interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export const TodoList = () => {
  const {
    todos,
    newTodo,
    handleNewTodoChange,
    handleAddTodo,
    handleToggleTodo,
    handleDeleteTodo,
    handleScrollSync,
    hoveredTodoId,
    scrollContainerRef,
    handleTodoMouseEnter,
    handleTodoMouseLeave,
    isSyncing,
    showCheckmark,
  } = useTodoBroadcast();
  const theme = useTheme();

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        height: '300px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        background: 'linear-gradient(145deg, rgba(94, 193, 61, 0.1), rgba(63, 173, 58, 0.05))',
      }}
    >
      <Typography
        variant="h6"
        gutterBottom
        sx={{
          color: theme.palette.text.primary,
          textShadow: '0 2px 4px rgba(0,0,0,0.2)',
        }}
      >
        Todo List
      </Typography>
      <Box
        component="form"
        onSubmit={handleAddTodo}
        sx={{
          display: 'flex',
          gap: 1,
          mb: 1,
        }}
      >
        <TextField
          fullWidth
          value={newTodo}
          onChange={handleNewTodoChange}
          placeholder="Add a new todo..."
          variant="outlined"
          size="small"
          InputProps={{
            style: {
              color: theme.palette.text.primary,
            },
          }}
        />
      </Box>
      <Box
        ref={scrollContainerRef}
        onScroll={handleScrollSync}
        sx={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '4px',
          },
        }}
      >
        <List>
          {todos.map((todo: Todo) => (
            <ListItem
              key={todo.id}
              onMouseEnter={() => handleTodoMouseEnter(todo.id)}
              onMouseLeave={handleTodoMouseLeave}
              sx={{
                opacity: hoveredTodoId === todo.id ? 0.7 : 1,
                transition: 'opacity 0.2s',
              }}
              secondaryAction={
                <IconButton
                  edge="end"
                  onClick={() => handleDeleteTodo(todo.id)}
                  size="small"
                  sx={{ color: theme.palette.primary.main }}
                >
                  <DeleteIcon />
                </IconButton>
              }
            >
              <Checkbox
                checked={todo.completed}
                onChange={() => handleToggleTodo(todo.id)}
                size="small"
                sx={{
                  color: theme.palette.primary.main,
                  '&.Mui-checked': {
                    color: theme.palette.primary.main,
                  },
                }}
              />
              <Typography
                sx={{
                  textDecoration: todo.completed ? 'line-through' : 'none',
                  color: todo.completed ? theme.palette.text.secondary : theme.palette.text.primary,
                }}
              >
                {todo.text}
              </Typography>
            </ListItem>
          ))}
        </List>
      </Box>
      {/* Sync Indicator */}
      <Fade in={isSyncing || showCheckmark}>
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: 'background.paper',
            borderRadius: 1,
            px: 1.5,
            py: 0.5,
            boxShadow: 1,
          }}
        >
          {isSyncing ? (
            <>
              <CircularProgress size={16} thickness={4} />
              <Typography variant="caption" color="text.secondary">
                Syncing...
              </Typography>
            </>
          ) : showCheckmark ? (
            <CheckCircleIcon
              sx={{
                color: theme.palette.success.main,
                fontSize: 20,
              }}
            />
          ) : null}
        </Box>
      </Fade>
    </Paper>
  );
};
