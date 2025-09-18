import Header from '../header.jsx'
import authService from '../../api/auth.service';
import { Link, Navigate} from "react-router-dom";

const Logout = () => {
    const handleSubmit = async (e) =>{
        e.preventDefault();
        try{
            authService.logout()
            .then((response) => {
                console.log(response);
            }, (err) => {
                console.log(err.response.data.dev);
            });
        } catch (error){
           console.log(error);
        }
    };

    return(
        <div>
            <Header />
                <div className={ "baseContainer" }>
                    <div className={ "formContainer" }>
                        <div className={ "message" }>
                            <h1>Вы уверены, что хотите выйти?</h1>
                            <p>Если вы выйдете, вам нужно будет снова войти в систему</p>
                            <input type="button" className={ "logout" } value="Выйти" onClick={ handleSubmit }/>
                        </div>
                    </div>
                </div>
        </div>
    );
}

export default Logout;
