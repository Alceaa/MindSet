import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Typography, List, ListItem } from '@mui/material';

const Sets = () => {
  const [sets, setSets] = useState([]);

  useEffect(() => {
  }, []);

  return (
    <div>
      <Typography variant="h4">Сеты</Typography>
      <Link to="/create-set">
        <button>Создать сет</button>
      </Link>
      <List>
        {sets.map((set) => (
          <ListItem key={set.id}>{set.name}</ListItem>
        ))}
      </List>
    </div>
  );
};

export default Sets;