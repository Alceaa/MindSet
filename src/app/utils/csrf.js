async function getCSRF(){
    return await fetch(process.env.REACT_APP_BASE_API_URL + "csrf/",{
        method: 'POST', 
        headers:{
            'Content-Type': 'application/json',
        }, 
        credentials: 'include'
    }
    )
    .then((res) => {
        return res.headers.get('X-CSRFToken')
    })
}

export default getCSRF;