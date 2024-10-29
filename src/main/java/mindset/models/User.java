package mindset.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "auser")
@Getter
@Setter
public class User {
    @Id
    @Column
    @GeneratedValue
    private Long id;

    @Column(unique=true)
    private String username;

    @Column(unique=true)
    private String email;
    @Column
    private String password;
}
