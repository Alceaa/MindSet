package mindset.controllers;

import jakarta.security.auth.message.AuthException;
import mindset.dto.requests.LoginRequest;
import mindset.dto.requests.RefreshJwtRequest;
import mindset.dto.requests.RegistrationRequest;
import mindset.dto.responses.AuthResponse;
import mindset.repository.UserRepository;
import mindset.services.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
@RestController
@CrossOrigin(origins = "*")
@RequestMapping("/api/auth/")

public class AuthController {
    private final UserRepository userRepository;
    private final AuthService authService;
    private final BCryptPasswordEncoder passwordBCrypt = new BCryptPasswordEncoder();
    public AuthController(UserRepository userRepository, AuthService authService){
        this.userRepository = userRepository;
        this.authService = authService;
    }

    @PostMapping("login")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) throws AuthException {
        final AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("registration")
    public ResponseEntity<AuthResponse> registration(@RequestBody RegistrationRequest request) throws AuthException {
        final AuthResponse response = authService.registration(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("token")
    public ResponseEntity<AuthResponse> getNewAccessToken(@RequestBody RefreshJwtRequest request) throws AuthException {
        final AuthResponse response = authService.getAccessToken(request.getRefreshToken());
        return ResponseEntity.ok(response);
    }

    @PostMapping("refresh")
    public ResponseEntity<AuthResponse> getNewRefreshToken(@RequestBody RefreshJwtRequest request) throws AuthException {
        final AuthResponse response = authService.refresh(request.getRefreshToken());
        return ResponseEntity.ok(response);
    }

}
