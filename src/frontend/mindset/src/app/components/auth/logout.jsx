import React from "react";
import { Link, Navigate} from "react-router-dom";
import "../../css/auth/auth.scss";
import Header from '../header.jsx'
import getCSRF from '../../utils/csrf.js';
class Logout extends React.Component{
    constructor(props) {
        super(props);
        this.state = {
            redirect: false,
        };
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    async handleSubmit(event){
        event.preventDefault();
        await fetch(process.env.REACT_APP_BASE_API_URL + "auth/logout",{
            method: 'POST', 
            headers:{
                'Content-Type': 'application/json',
                'X-CSRFToken': this.state.csrftoken
            }, 
            credentials: 'include',
        }
        )
        .then((res) => {
            return res.json();
        })
        .then((data) => {
            if(data.status == "Success"){
                localStorage.setItem("isLogged", "false");
                this.setState({
                    redirect: true
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
        if(localStorage.getItem("isLogged") === "false"){
            this.setState({
                redirect: true
            })
        }
    }

    render(){
        if (this.state.redirect){
            return <Navigate to="../signin/" />
        }
        return(
            <div>
            <Header />
                <div className={ "baseContainer" }>
                    <div className={ "formContainer" }>
                        <div className={ "message" }>
                            <h1>Вы уверены, что хотите выйти?</h1>
                            <p>Если вы выйдете, вам нужно будет снова войти в систему</p>
                            <input type="button" className={ "logout" } value="Выйти" onClick={ this.handleSubmit }/>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

export default Logout;