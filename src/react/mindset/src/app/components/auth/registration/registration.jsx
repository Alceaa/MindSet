import React from "react";
import "../../../css/auth/auth.scss";
import Header from '../../header.jsx'
import { Link } from "react-router-dom";

class Registration extends React.Component{
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
        console.log(this.state.login)
        const response = await fetch(process.env.REACT_APP_BASE_API_URL + "auth/registration",
            {method: 'POST', headers:{'Content-Type': 'application/json'}, body: JSON.stringify(
                {
                    "username":this.state.login,
                    "email":this.state.email,
                    "password1":this.state.password1,
                    "password2":this.state.password2
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
                        <h2 className={ "formTitle" }>Регистрация</h2>
                        <form onSubmit={this.handleSubmit}>
                            <label>
                                Почта:
                                <input name="email" type="email" value={this.state.email || ''} onChange={this.handleInputChange}/>
                            </label>
                            <label>
                                Имя пользователя:
                                <input name="login" type="text" value={this.state.login || ''} onChange={this.handleInputChange}/>
                            </label>
                            <label>
                                Пароль:
                                <input name="password1" type="password" onChange={this.handleInputChange}/>
                            </label>
                            <label>
                                Повторите пароль:
                                <input name="password2" type="password" onChange={this.handleInputChange}/>
                            </label>
                            <div name="error" className={ "errorMessage" }></div>
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
}

export default Registration;