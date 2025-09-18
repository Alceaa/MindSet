import React, { useState } from 'react';
import Header from '../../header.jsx'
import authService from '../../../api/auth.service';
import { Link, Navigate} from "react-router-dom";

const Login = () => {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    
    const handleSubmit = async (e) =>{
        e.preventDefault();
        setError('');
        try{
            authService.login(login, password)
            .then((response) => {
                console.log(response);
            }, (err) => {
                console.log(err.response.data.dev);
                if (err.response && err.response.status === 400) {
                    setError(err.response.data.message || 'Ошибка входа');
                } else {
                    setError('Произошла ошибка. Попробуйте еще раз.');
                }
            });
        } catch (error){
            setError('Произошла ошибка. Попробуйте еще раз.');
        }
    };

    return(
        <div>
            <Header />
            <div className={ "baseContainer" }>
                <div className={ "formContainer" }>
                    <h2 className={ "formTitle" }>Вход</h2>
                    <form onSubmit={handleSubmit}>
                        <label>
                            Имя пользователя или почта:
                            <input name="login" type="text" onChange={(e) => setLogin(e.target.value)} required/>
                        </label>
                        <label>
                            Пароль:
                            <input name="password" type="password" onChange={(e) => setPassword(e.target.value)} required/>
                        </label>
                        <div name="error" className={ "errorMessage" }>{error}</div>
                        <div className={ "bottomContainer" }>
                            <Link className={ "link" } to={'/../signup/'}>Создать аккаунт</Link>
                            <input type="submit" value="Войти"/>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Login;
