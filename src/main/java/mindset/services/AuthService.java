package mindset.services;

import io.jsonwebtoken.Claims;
import jakarta.security.auth.message.AuthException;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import mindset.dto.requests.LoginRequest;
import mindset.dto.requests.RegistrationRequest;
import mindset.dto.responses.AuthResponse;
import mindset.models.User;
import mindset.repository.UserRepository;
import org.antlr.v4.runtime.misc.NotNull;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final BCryptPasswordEncoder passwordBCrypt = new BCryptPasswordEncoder();
    private final JwtProvider jwtProvider;
    private final Map<String, String> refreshStorage = new HashMap<>();

    @Autowired
    private UserRepository userRepository;

    public AuthResponse login(@NotNull LoginRequest request) throws AuthException {
        User foundUser = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new AuthException("Пользователь не найден"));
        if(validateUser(foundUser, request.getUsername(), request.getPassword())){
            final String accessToken = jwtProvider.generateAccessToken(foundUser);
            final String refreshToken = jwtProvider.generateRefreshToken(foundUser);
            refreshStorage.put(foundUser.getUsername(), refreshToken);
            return new AuthResponse("Вход выполнен!", accessToken, refreshToken);
        }else {
            throw new AuthException("Неправильный пароль");
        }
    }

    public AuthResponse registration(@NonNull RegistrationRequest request) throws AuthException{
        String validationResult = validateRegistration(request.getUsername(), request.getEmail(),
                request.getPassword1(), request.getPassword2());
        if(validationResult.equals("validated")){
            User newUser = new User();
            newUser.setUsername(request.getUsername());
            newUser.setEmail(request.getEmail());
            newUser.setPassword(passwordBCrypt.encode(request.getPassword1()));
            userRepository.save(newUser);
            final String accessToken = jwtProvider.generateAccessToken(newUser);
            final String refreshToken = jwtProvider.generateRefreshToken(newUser);
            refreshStorage.put(newUser.getUsername(), refreshToken);
            return new AuthResponse("Регистрация успешно выполнена!", accessToken, refreshToken);
        }else {
            throw new AuthException(validationResult);
        }
    }
    public boolean validateUser(User user, String username, String password) {
        String validUsername = user.getUsername();
        String validPassword = user.getPassword();
        if (!validUsername.equals(username)) {
            return false;
        }
        return passwordBCrypt.matches(password, validPassword);
    }

    public String validateRegistration(String username, String email, String password1, String password2){
        if(userRepository.findByUsername(username).isPresent()){
            return "Пользователь с таким логином уже существует!";
        }
        if(userRepository.findByEmail(email).isPresent()){
            return "Пользователь с такой электронной почтой уже существует!";
        }
        if(!password1.equals(password2)) {
            return "Пароли не совпадают!";
        }
        return "validated";
    }

    public AuthResponse getAccessToken(@NonNull String refreshToken) throws AuthException {
        if (jwtProvider.validateRefreshToken(refreshToken)) {
            final Claims claims = jwtProvider.getRefreshClaims(refreshToken);
            final String login = claims.getSubject();
            final String saveRefreshToken = refreshStorage.get(login);
            if (saveRefreshToken != null && saveRefreshToken.equals(refreshToken)) {
                final User user = userRepository.findByUsername(login)
                        .orElseThrow(() -> new AuthException("Пользователь не найден!"));
                final String accessToken = jwtProvider.generateAccessToken(user);
                return new AuthResponse("Access Token", accessToken, null);
            }
        }
        return new AuthResponse("Access Token", null, null);
    }

    public AuthResponse refresh(@NonNull String refreshToken) throws AuthException {
        if (jwtProvider.validateRefreshToken(refreshToken)) {
            final Claims claims = jwtProvider.getRefreshClaims(refreshToken);
            final String login = claims.getSubject();
            final String saveRefreshToken = refreshStorage.get(login);
            if (saveRefreshToken != null && saveRefreshToken.equals(refreshToken)) {
                final User user = userRepository.findByUsername(login)
                        .orElseThrow(() -> new AuthException("Пользователь не найден"));
                final String accessToken = jwtProvider.generateAccessToken(user);
                final String newRefreshToken = jwtProvider.generateRefreshToken(user);
                refreshStorage.put(user.getUsername(), newRefreshToken);
                return new AuthResponse("Refresh Tokens", accessToken, newRefreshToken);
            }
        }
        throw new AuthException("Невалидный JWT токен!");
    }
}
