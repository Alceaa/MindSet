package mindset.dto.requests;

import lombok.Getter;

@Getter
public class RegistrationRequest {
    private String username;
    private String email;
    private String password1;
    private String password2;
}
