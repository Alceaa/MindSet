import React, { useEffect, useState } from 'react';
import { Typography, List, ListItem } from '@mui/material';

const Sets = () => {
  const [sets, setSets] = useState([]);

  useEffect(() => {
  }, []);

  return (
    <div>
      <Typography variant="h4">Сеты</Typography>
      <List>
        {sets.map((set) => (
          <ListItem key={set.id}>{set.name}</ListItem>
        ))}
      </List>
    </div>
  );
};

export default Sets;