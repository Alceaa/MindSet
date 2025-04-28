import React from "react";
import "../../../css/auth/auth.scss";
import Header from '../../header.jsx'
import { Link, Navigate} from "react-router-dom";
import getCSRF from '../../../utils/csrf.js';

class Login extends React.Component{
    constructor(props) {
        super(props);
        this.state = {
            redirect: false,
        }
        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }


    handleInputChange(event) {
        const value = event.target.value;
        const name = event.target.name;

        this.setState({
            [name]: value
        });
    }
    
    async handleSubmit(event) {
        event.preventDefault();
        await fetch(process.env.REACT_APP_BASE_API_URL + "auth/login",{
            method: 'POST', 
            headers:{
                'Content-Type': 'application/json', 
                'X-CSRFToken': this.state.csrftoken
            },
            credentials: 'include',
            body: JSON.stringify(
                {
                    "username":this.state.login,
                    "password":this.state.password
                }
            )}
        )
        .then((res) => {
            this.setState({
                isLoggedIn: true
            })
            return res.json();
        })
        .then((data) => {
            if(data.status == "Success"){
                localStorage.setItem("isLogged", "true");
                this.setState({
                    redirect: true
                })
            }
            if(data.error != null){
                this.setState({
                    error: data.error
                })
            }
        })
    }

    componentDidMount(){
        getCSRF().then((csrf) =>{
            this.setState({
                csrftoken: csrf
            })
        })
        if(localStorage.getItem("isLogged") === "true"){
            this.setState({
                redirect: true
            })
        }
    }

    render(){
        if (this.state.redirect){
            return <Navigate to="/" />
        }
        return(
            <div>
                <Header />
                <div className={ "baseContainer" }>
                    <div className={ "formContainer" }>
                        <h2 className={ "formTitle" }>Вход</h2>
                        <form onSubmit={this.handleSubmit}>
                            <label>
                                Имя пользователя или почта:
                                <input name="login" type="text" onChange={this.handleInputChange} required/>
                            </label>
                            <label>
                                Пароль:
                                <input name="password" type="password" onChange={this.handleInputChange} required/>
                            </label>
                            <div name="error" className={ "errorMessage" }>{this.state.error}</div>
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
}

export default Login;