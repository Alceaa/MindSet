import React, { useState } from 'react';
import Header from '../../header.jsx'
import authService from '../../../api/auth.service';
import { Link, Navigate} from "react-router-dom";

const Registration = () => {
    const [login, setLogin] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [error, setError] = useState('');
    
    const handleSubmit = async (e) =>{
        e.preventDefault();
        setError('');
        try{
            authService.register(login, email, password, passwordConfirm)
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
                        <h2 className={ "formTitle" }>Регистрация</h2>
                        <form onSubmit={handleSubmit}>
                            <label>
                                Почта:
                                <input name="email" type="email" value={email || ''} onChange={(e) => setEmail(e.target.value)} required/>
                            </label>
                            <label>
                                Имя пользователя:
                                <input name="login" type="text" value={login || ''} onChange={(e) => setLogin(e.target.value)} required/>
                            </label>
                            <label>
                                Пароль:
                                <input name="password1" type="password" onChange={(e) => setPassword(e.target.value)} required/>
                            </label>
                            <label>
                                Повторите пароль:
                                <input name="password2" type="password" onChange={(e) => setPasswordConfirm(e.target.value)} required/>
                            </label>
                            <div name="error" className={ "errorMessage" }>{error}</div>
                            <div className={ "bottomContainer" }>
                                <Link className={ "link" } to={'/../signin/'}>Уже есть аккаунт</Link>
                                <input type="submit" value="Зарегистрироваться"/>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
    );
}

export default Registration;
