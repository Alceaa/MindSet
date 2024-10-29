package mindset.web.controllers;

import mindset.models.Set;
import mindset.repository.SetRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@CrossOrigin(origins = "*", maxAge = 4800)
@RequestMapping("api/sets")
public class SetController {
    private final SetRepository setRepository;

    public SetController(SetRepository setRepository){
        this.setRepository = setRepository;
    }

    @GetMapping
    public List<Set> getSets() {
        return setRepository.findAll();
    }

    @GetMapping("/hello")
    public ResponseEntity hello(){
        return ResponseEntity.ok("hello react!!!");
    }
}
