import React from "react";
import "../../../css/auth/auth.scss";
import Header from '../../header.jsx'
import { Link } from "react-router-dom";

class Login extends React.Component{
    constructor(props) {
        super(props);
        this.state = {};

        this.handleInputChange = this.handleInputChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    async componentDidMount() {
        
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
        const response = await fetch(process.env.REACT_APP_BASE_API_URL + "auth/login",
            {method: 'POST', headers:{'Content-Type': 'application/json'},  body: JSON.stringify(
                {
                    "username":this.state.login,
                    "password":this.state.password
                }
            )}
        );
        let data = await response.json()
        console.log(data)
    }
    render(){
        return(
            <div>
                <Header />
                <div className={ "baseContainer" }>
                    <div className={ "formContainer" }>
                        <h2 className={ "formTitle" }>Вход</h2>
                        <form onSubmit={this.handleSubmit}>
                            <label>
                                Почта:
                                <input name="email" type="email" onChange={this.handleInputChange}/>
                            </label>
                            <label>
                                Имя пользователя:
                                <input name="login" type="text" onChange={this.handleInputChange}/>
                            </label>
                            <label>
                                Пароль:
                                <input name="password" type="password" onChange={this.handleInputChange}/>
                            </label>
                            <div name="error" className={ "errorMessage" }></div>
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