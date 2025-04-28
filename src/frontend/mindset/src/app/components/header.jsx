import React from "react";
import "../css/base.scss";

class Header extends React.Component{
    render(){
        return(
            <div className={ "header" }>
                <div className={ "headerLeft" }>
                    <nav className={ "nav" }>
                        <button className={ "navButton" }>Навигация</button>
                    </nav>
                    <div className={ "logo" }>Логотип</div>
                </div>
                <div className={ "headerRight" }>
                    <div className={ "searchInput" }>
                        <input type="text" placeholder="Поиск..." />
                    </div>
                    <button className={ "searchButton" }>Поиск</button>
                </div>
            </div>
        )
    }
}

export default Header;