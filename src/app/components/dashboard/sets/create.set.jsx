import React, { useState } from 'react';
import setService from '../../../api/set.service';
const CreateSet = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try{
            setService.createSet(title, description)
            .then((response) => {
                console.log(response);
            }, (err) => {
                console.log(err.response.data.dev);
                if (err.response && err.response.status === 400) {
                    setError(err.response.data.message || 'Неверный формат запроса');
                } else {
                    setError('Произошла ошибка. Попробуйте еще раз.');
                }
            });
        } catch (error){
            setError('Произошла ошибка. Попробуйте еще раз.');
        }
    } 

    return (
        <div>
        <h1>Создать новый сет</h1>
        <form onSubmit={handleSubmit}>
            <div>
                <label>Название:</label>
                <input 
                    type="text" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    required 
                />
            </div>
            <div>
                <label>Описание (до 250 символов):</label>
                <input 
                    type="textarea" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    required 
                />
            </div>
            <button type="submit">Создать</button>
            <div name="error" className={ "errorMessage" }>{error}</div>
        </form>
        </div>
    );
}

export default CreateSet;