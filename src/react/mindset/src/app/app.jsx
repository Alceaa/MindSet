import React from "react";
import ReactDom from "react-dom";
const USER_API_BASE_URL = "http://localhost:8080/";

class App extends React.Component{
    constructor(props) {
      super(props);
      this.state = {message: ''};
    }

    async componentDidMount() {
        const response = await fetch(USER_API_BASE_URL + 'sets/hello');
        const body = await response.text();
        this.setState({message: body});
    }
    render(){
       return <p>Ответ: {this.state.message}</p>
    }
}
ReactDom.render(<App />, document.getElementById('react'));

export default App;