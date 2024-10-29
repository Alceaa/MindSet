package mindset.models;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "set")
@Getter
@Setter
public class Set {
    @Id
    @GeneratedValue
    private Long id;

    private String name;
}